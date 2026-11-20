import { activityOutcome } from '../history/history.service.js';
import { db } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { authenticateToken, type AuthenticatedRequest } from '../auth/auth.middleware.js';
import { canAccessHome, findOwnedDevice, ownsHome, requireHomeOwner } from '../homes/home.access.js';
import { homeService } from '../homes/home.service.js';
import { Router, type Response, type NextFunction } from 'express';
import { deviceService } from './device.service.js';

export const deviceRouter = Router();

deviceRouter.use(authenticateToken);
deviceRouter.param('homeId', async (req: AuthenticatedRequest, res, next, homeId) => {
  if (!/^\/home\/[^/]+\/?$/.test(req.path)) return requireHomeOwner(req, res, next, homeId);
  try {
    if (!req.user || !await canAccessHome(req.user.id, homeId)) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    next();
  } catch (error) {
    next(error);
  }
});
deviceRouter.param('id', async (req: AuthenticatedRequest, res: Response, next: NextFunction, id: string) => {
  try {
    const includeMembers = req.method === 'GET' || (req.method === 'POST' && req.path.replace(/\/$/, '').endsWith('/action'));
    const device = req.user && await findOwnedDevice(req.user.id, id, includeMembers, req.method !== 'GET');
    if (!device) return res.status(404).json({ success: false, error: 'Device not found' });
    req.params.id = device.device_id;
    next();
  } catch (error) {
    next(error);
  }
});

deviceRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const homes = await homeService.getAccessibleHomes(req.user!.id);
    const devices = (await Promise.all(homes.map(home => deviceService.getDevicesByHome(home.id, req.user!.id)))).flat();
    return res.json({ success: true, devices });
  } catch (error) {
    next(error);
  }
});

deviceRouter.get('/home/:homeId/pairing-config', (_req, res) => {
  if (!ENV.MQTT_DEVICE_USERNAME || !ENV.MQTT_DEVICE_PASSWORD) {
    return res.status(503).json({ success: false, error: 'Device pairing is temporarily unavailable' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    mqttHost: ENV.MQTT_PUBLIC_HOST,
    mqttPort: ENV.MQTT_PUBLIC_PORT,
    mqttUsername: ENV.MQTT_DEVICE_USERNAME,
    mqttPassword: ENV.MQTT_DEVICE_PASSWORD,
  });
});

// POST /api/devices/provision - Provision physical device with parent and child endpoints
deviceRouter.post('/provision', async (req: AuthenticatedRequest, res) => {
  try {
    const { deviceId, homeId, roomId, modelCode, mac4, customName, icon, wifiSsid, wifiPassword, firmwareVersion, ipAddress } = req.body;
    if (!homeId || !modelCode || !customName || !wifiSsid) {
      return res.status(400).json({ success: false, error: 'homeId, modelCode, customName and wifiSsid are required' });
    }

    if (!await ownsHome(req.user!.id, homeId)) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    const verification = await db.query('SELECT clock_timestamp() AS started_at');
    const result = await deviceService.provisionDevice({
      deviceId: deviceId ? String(deviceId).trim() : undefined,
      homeId,
      roomId,
      modelCode,
      mac4: mac4 || 'BC88',
      customName,
      icon,
      wifiSsid,
      wifiPassword,
      firmwareVersion: firmwareVersion || 'v1.2.4-neuro',
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      ...result,
      verificationFrom: verification.rows[0].started_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Provisioning failed';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/devices/home/:homeId - Get all devices with endpoints for a home
deviceRouter.get('/home/:homeId', async (req: AuthenticatedRequest, res) => {
  try {
    const homeId = Array.isArray(req.params.homeId) ? req.params.homeId[0] : req.params.homeId;
    const devices = await deviceService.getDevicesByHome(homeId, req.user!.id);
    return res.json({ success: true, devices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch home devices';
    return res.status(500).json({ success: false, error: message });
  }
});

deviceRouter.patch('/:id', async (req, res, next) => {
  const { name, roomId } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 ||
      (roomId !== null && typeof roomId !== 'string')) {
    return res.status(400).json({ success: false, error: 'Enter a name of up to 80 characters and choose a room.' });
  }
  try {
    const result = await db.query(
      `UPDATE devices d SET custom_name = $2, room_id = r.id, updated_at = NOW()
       FROM (SELECT (SELECT id FROM rooms WHERE id::text = $3) AS id) r
       WHERE d.device_id = $1
         AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM rooms WHERE id = r.id AND home_id = d.home_id))
       RETURNING d.custom_name, d.room_id`,
      [req.params.id, name.trim(), roomId]
    );
    if (!result.rowCount) return res.status(400).json({ success: false, error: 'Room does not belong to this location.' });
    return res.json({ success: true, device: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

deviceRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM devices WHERE device_id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Device not found' });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Device middleware checks home access before this query.
deviceRouter.get('/:id/pairing-status', async (req, res, next) => {
  const after = typeof req.query.after === 'string' ? new Date(req.query.after) : null;
  if (!after || !Number.isFinite(after.getTime())) {
    return res.status(400).json({ success: false, error: 'A valid setup start time is required.' });
  }
  try {
    const result = await db.query(
      `SELECT (is_online IS TRUE AND last_seen_at > $2::timestamptz
        AND last_seen_at > clock_timestamp() - INTERVAL '12 seconds') AS online, last_seen_at
       FROM devices WHERE device_id = $1`,
      [req.params.id, after.toISOString()]
    );
    res.setHeader('Cache-Control', 'no-store');
    const row = result.rows[0];
    return res.json({ online: row?.online === true, lastSeenAt: row?.online === true ? row.last_seen_at : null });
  } catch (error) {
    next(error);
  }
});

// GET /api/devices/:id - Get single device
deviceRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM devices WHERE device_id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Device not found' });
    return res.json({ success: true, device: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/devices/:id/action - Control hardware switch channel (e.g. {"action":"on","channel":3})
deviceRouter.post('/:id/action', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { action, channel } = req.body;
    if (channel === undefined || channel === null) {
      return res.status(400).json({ success: false, error: 'Channel is required (1-8)' });
    }
    const chNum = parseInt(String(channel), 10);
    if (action !== 'on' && action !== 'off' && action !== 'toggle') {
      return res.status(400).json({ success: false, error: 'Invalid switch action' });
    }

    const result = await deviceService.controlSwitch(id, chNum, action);
    return res.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Switch control failed';
    return res.status(400).json({ success: false, error: message });
  }
});

// PUT & POST /api/devices/:id/switches/config - Update switch names and icons across devices
const handleSwitchConfigsUpdate = async (req: any, res: any) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const configs = req.body.configs || req.body.switchConfigs || req.body;
    if (!Array.isArray(configs)) {
      return res.status(400).json({ success: false, error: 'Array of switch configurations is required' });
    }
    const result = await deviceService.updateSwitchConfigs(id, configs);
    return res.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update switch configs';
    return res.status(500).json({ success: false, error: message });
  }
};

deviceRouter.put('/:id/switches/config', handleSwitchConfigsUpdate);
deviceRouter.post('/:id/switches/config', handleSwitchConfigsUpdate);
deviceRouter.put('/:id/switch-configs', handleSwitchConfigsUpdate);
deviceRouter.post('/:id/switch-configs', handleSwitchConfigsUpdate);

// POST /api/devices/:id/reset-energy - Reset energy counter on hardware and database
deviceRouter.post(['/:id/reset-energy', '/:id/reset_energy'], async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await deviceService.resetEnergy(id);
    return res.json({
      success: true,
      message: `Energy reset command sent to hardware (${id}). Energy counter started from 0.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset energy counter';
    return res.status(500).json({ success: false, error: message });
  }
});

deviceRouter.get('/:id/activity', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.id::text, a.channel, a.target, a.created_at, a.observed_at, a.failure, ${activityOutcome}
       FROM device_activity a JOIN devices d ON d.id = a.device_id
       WHERE d.device_id = $1 ORDER BY a.id DESC LIMIT 100`, [req.params.id]
    );
    res.json({ entries: result.rows });
  } catch (error) { next(error); }
});

deviceRouter.get('/:id/energy', async (req, res, next) => {
  try {
    const monthly = req.query.period === 'month';
    const result = await db.query(
      `SELECT to_char(date_trunc(CASE WHEN $2 THEN 'month' ELSE 'day' END, u.day::timestamp),
            CASE WHEN $2 THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END) AS period, SUM(u.kwh)::float AS kwh
         FROM energy_usage u JOIN devices d ON d.id = u.device_id
         WHERE d.device_id = $1 AND u.day >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date -
            CASE WHEN $2 THEN INTERVAL '11 months' + (EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Asia/Kolkata')) - 1) * INTERVAL '1 day'
            ELSE INTERVAL '29 days' END
         GROUP BY 1 ORDER BY 1`, [req.params.id, monthly]
    );
    const thresholds = await db.query(
      'SELECT t.watts::float FROM energy_thresholds t JOIN devices d ON d.id = t.device_id WHERE d.device_id = $1',
      [req.params.id]
    );
    res.json({ periods: result.rows, watts: thresholds.rows[0]?.watts ?? null });
  } catch (error) { next(error); }
});

deviceRouter.put('/:id/energy-threshold', async (req, res, next) => {
  const watts: unknown = req.body?.watts;
  if (watts !== null && (typeof watts !== 'number' || !Number.isFinite(watts) || watts <= 0 || watts > 1e9)) {
    return res.status(400).json({ error: 'Enter a positive power threshold in watts' });
  }
  try {
    if (watts === null) {
      await db.query('DELETE FROM energy_thresholds t USING devices d WHERE d.id = t.device_id AND d.device_id = $1', [req.params.id]);
    } else {
      const saved = await db.query(
        `INSERT INTO energy_thresholds (device_id, watts, above)
         SELECT id, $2, COALESCE(power >= $2, false) FROM devices
         WHERE device_id = $1 AND model_code IN ('EM1','EMS1','EM3','EMS3')
         ON CONFLICT (device_id) DO UPDATE SET watts = EXCLUDED.watts, above = EXCLUDED.above
         RETURNING device_id`, [req.params.id, watts]
      );
      if (!saved.rowCount) return res.status(404).json({ error: 'Energy meter not found' });
    }
    return res.json({ success: true });
  } catch (error) { next(error); }
});
