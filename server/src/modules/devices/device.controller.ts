import { Router } from 'express';
import { deviceService } from './device.service.js';

export const deviceRouter = Router();

// GET /api/devices - List all devices
deviceRouter.get('/', (_req, res) => {
  const devices = deviceService.getDevices();
  return res.json({ success: true, devices });
});

// POST /api/devices/provision - Provision physical device with parent and child endpoints
deviceRouter.post('/provision', async (req, res) => {
  try {
    const { deviceId, homeId, roomId, modelCode, mac4, customName, icon, wifiSsid, wifiPassword, firmwareVersion, ipAddress } = req.body;
    if (!homeId || !modelCode || !customName || !wifiSsid) {
      return res.status(400).json({ success: false, error: 'homeId, modelCode, customName and wifiSsid are required' });
    }

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
      ipAddress: ipAddress || '192.168.4.1',
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Provisioning failed';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/devices/home/:homeId - Get all devices with endpoints for a home
deviceRouter.get('/home/:homeId', async (req, res) => {
  try {
    const homeId = Array.isArray(req.params.homeId) ? req.params.homeId[0] : req.params.homeId;
    const devices = await deviceService.getDevicesByHome(homeId);
    return res.json({ success: true, devices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch home devices';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/devices - Add a new device
deviceRouter.post('/', (req, res) => {
  try {
    const { name, room, type, homeId } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Device name is required' });
    }
    const device = deviceService.addDevice({ name, room, type, homeId });
    return res.status(201).json({ success: true, device });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add device';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/devices/:id - Get single device
deviceRouter.get('/:id', (req, res) => {
  const device = deviceService.getDeviceById(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  return res.json({ success: true, device });
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
    const act = (action === 'on' || action === 'off' || action === 'toggle') ? action : 'toggle';

    const result = await deviceService.controlSwitch(id, chNum, act);
    return res.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Switch control failed';
    return res.status(400).json({ success: false, error: message });
  }
});

// PATCH /api/devices/:id/state - Update device state & publish to EMQX
deviceRouter.patch('/:id/state', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    // Check if channel action was passed in body
    if (req.body.channel !== undefined) {
      const chNum = parseInt(String(req.body.channel), 10);
      const action = req.body.action || (req.body.state === true ? 'on' : req.body.state === false ? 'off' : 'toggle');
      const result = await deviceService.controlSwitch(id, chNum, action);
      return res.json({ success: true, ...result });
    }

    const updated = await deviceService.updateDeviceState(id, req.body);
    return res.json({ success: true, device: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update device';
    return res.status(400).json({ success: false, error: message });
  }
});

