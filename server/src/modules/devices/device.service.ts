import { markObserved } from '../history/history.service.js';
import { memberDeviceScope } from '../homes/home.access.js';
import { normalizeReadings, normalizeSwitches } from './telemetry.js';
import { emqxService } from '../mqtt/emqx.client.js';
import { socketManager } from '../websocket/socket.server.js';
import { db } from '../../config/database.js';
import type { DeviceRecord, DeviceEndpointRecord, ProvisionDeviceDTO } from './device.types.js';

interface EndpointConfig {
  name: string;
  type: 'RELAY' | 'PHASE' | 'SENSOR';
}

class DeviceService {
  /**
   * Automatically initializes `devices` and `device_endpoints` tables in PostgreSQL
   */
  public async ensureTablesExist(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS devices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
          room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
          device_id VARCHAR(64) NOT NULL UNIQUE,
          mac_4 VARCHAR(4) NOT NULL,
          model_code VARCHAR(30) NOT NULL,
          custom_name VARCHAR(100) NOT NULL,
          wifi_ssid VARCHAR(64) NOT NULL,
          rssi INT DEFAULT NULL,
          ip_address VARCHAR(45),
          firmware_version VARCHAR(30),
          is_online BOOLEAN DEFAULT FALSE,
          last_seen_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_devices_room_id ON devices(room_id);
      CREATE INDEX IF NOT EXISTS idx_devices_home_id ON devices(home_id);
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS icon VARCHAR(255);
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS switches JSONB DEFAULT '{}';
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS switch_configs JSONB DEFAULT '[]';
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS uptime_sec INT DEFAULT NULL;

      -- Single Phase & Three Phase Energy Meter Telemetry Fields
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS voltage NUMERIC(8,2) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS current NUMERIC(8,4) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS power NUMERIC(10,2) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS apparent_power NUMERIC(10,2) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS reactive_power NUMERIC(10,2) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS power_factor NUMERIC(6,3) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS frequency NUMERIC(6,2) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS energy_kwh NUMERIC(12,4) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS energy_wh NUMERIC(12,2) DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS relay BOOLEAN DEFAULT NULL;
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS trip_reason VARCHAR(255) DEFAULT '';
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS alerts JSONB DEFAULT '{}';
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS energy_data JSONB DEFAULT '{}';

      CREATE TABLE IF NOT EXISTS device_endpoints (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
          endpoint_index INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          icon VARCHAR(255) DEFAULT NULL,
          endpoint_type VARCHAR(20) NOT NULL CHECK (endpoint_type IN ('RELAY', 'PHASE', 'SENSOR')),
          state JSONB DEFAULT '{"status": "OFF"}',
          is_favorite BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(device_id, endpoint_index)
      );

      CREATE INDEX IF NOT EXISTS idx_endpoints_device_id ON device_endpoints(device_id);
    `;
    try {
      await db.query(query);
      console.log('✅ Devices and Device Endpoints tables verified in PostgreSQL');

      // Register MQTT Handlers for incoming hardware telemetry & heartbeats
      emqxService.onTelemetry(async (deviceId, payload) => {
        await this.handleTelemetryUpdate(deviceId, payload);
      });

      emqxService.onHeartbeat(async (deviceId, payload) => {
        await this.handleHeartbeat(deviceId, payload);
      });

      // 12-second watchdog timer: If hardware hasn't sent RSSI/telemetry within 12 seconds, mark it offline
      setInterval(async () => {
        try {
          const timeoutResult = await db.query(
            `UPDATE devices 
             SET is_online = false, updated_at = CURRENT_TIMESTAMP 
             WHERE is_online = true AND (last_seen_at IS NULL OR last_seen_at < CURRENT_TIMESTAMP - INTERVAL '12 seconds')
             RETURNING device_id`
          );
          if (timeoutResult.rows.length > 0) {
            for (const row of timeoutResult.rows) {
              console.log(`⏱️ [DEVICE TIMEOUT (12s)] Device ${row.device_id} marked offline (no RSSI/heartbeat within 12s)`);
              socketManager.broadcastDeviceUpdate(row.device_id, {
                deviceId: row.device_id,
                is_online: false,
              });
            }
          }
        } catch {
          // ignore
        }
      }, 2000).unref();
    } catch (err) {
      console.error('❌ Failed to initialize devices tables:', err);
      throw err;
    }
  }

  /**
   * Generates a device ID in format: ntxx-mac4-Code
   * Example: nt8k-BC88-TP8
   */
  public generateDeviceId(mac4: string, modelCode: string): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const xx1 = chars[Math.floor(Math.random() * chars.length)];
    const xx2 = chars[Math.floor(Math.random() * chars.length)];
    const cleanMac = (mac4 || '0000').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4);
    const cleanCode = (modelCode || 'DEV').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `nt${xx1}${xx2}-${cleanMac}-${cleanCode}`;
  }

  /**
   * Defines endpoints based on model code
   */
  public getEndpointsForModel(modelCode: string): EndpointConfig[] {
    const code = (modelCode || '').toUpperCase();
    switch (code) {
      case 'TP4':
        return [
          { name: 'Switch 1', type: 'RELAY' },
          { name: 'Switch 2', type: 'RELAY' },
          { name: 'Switch 3', type: 'RELAY' },
          { name: 'Switch 4', type: 'RELAY' },
        ];
      case 'TP6':
        return Array.from({ length: 6 }, (_, i) => ({ name: `Switch ${i + 1}`, type: 'RELAY' }));
      case 'TP8':
        return Array.from({ length: 8 }, (_, i) => ({ name: `Switch ${i + 1}`, type: 'RELAY' }));
      case 'TP12':
        return Array.from({ length: 12 }, (_, i) => ({ name: `Switch ${i + 1}`, type: 'RELAY' }));
      case 'SN':
        return [
          { name: 'Socket', type: 'RELAY' },
          { name: 'Switch', type: 'RELAY' },
        ];
      case 'PN':
        return [{ name: 'Switch 1', type: 'RELAY' }];
      case 'GATE':
        return [{ name: 'Gate Trigger', type: 'RELAY' }];
      case 'IR1':
        return [{ name: 'IR Remote', type: 'RELAY' }];
      case 'IRP':
        return [
          { name: 'IR Remote', type: 'RELAY' },
          { name: 'AC Control', type: 'RELAY' },
        ];
      case 'EM1':
        return [{ name: 'Power Meter', type: 'SENSOR' }];
      case 'EMS1':
        return [
          { name: 'Power Meter', type: 'SENSOR' },
          { name: 'Switch 1', type: 'RELAY' },
        ];
      case 'EM3':
        return [
          { name: 'Phase R', type: 'PHASE' },
          { name: 'Phase Y', type: 'PHASE' },
          { name: 'Phase B', type: 'PHASE' },
        ];
      case 'EMS3':
        return [
          { name: 'Phase R', type: 'PHASE' },
          { name: 'Phase Y', type: 'PHASE' },
          { name: 'Phase B', type: 'PHASE' },
          { name: 'Main Switch', type: 'RELAY' },
        ];
      case 'SHUB':
        return [
          { name: 'Temperature', type: 'SENSOR' },
          { name: 'Humidity', type: 'SENSOR' },
        ];
      case 'MSEN':
        return [{ name: 'Motion Detector', type: 'SENSOR' }];
      case 'MTR':
        return [
          { name: 'Motor Power', type: 'RELAY' },
          { name: 'Direction', type: 'RELAY' },
        ];
      case 'AQUA':
        return [
          { name: 'Aqua Pump', type: 'RELAY' },
          { name: 'Flow Sensor', type: 'SENSOR' },
        ];
      case 'HP16':
        return [{ name: 'Heavy Outlet 16A', type: 'RELAY' }];
      case 'HA1':
        return [{ name: 'Hi Amp Load', type: 'RELAY' }];
      case 'CRT':
        return [{ name: 'Curtain Driver', type: 'RELAY' }];
      case 'CRTT':
        return [
          { name: 'Curtain Driver', type: 'RELAY' },
          { name: 'Touch Switch', type: 'RELAY' },
        ];
      case 'TNK':
        return [
          { name: 'Tank Level', type: 'SENSOR' },
          { name: 'Water Pump', type: 'RELAY' },
        ];
      case 'TNKP':
        return [
          { name: 'Tank Level Pro', type: 'SENSOR' },
          { name: 'Inlet Valve', type: 'RELAY' },
          { name: 'Auto Pump', type: 'RELAY' },
        ];
      case 'HUB':
        return [{ name: 'Smart Hub Gateway', type: 'RELAY' }];
      case 'SHA':
        return [{ name: 'Smart Home Adapter', type: 'RELAY' }];
      case 'LTCL':
        return [{ name: 'Ceiling Light', type: 'RELAY' }];
      case 'LTRGB':
        return [{ name: 'RGB Light', type: 'RELAY' }];
      case 'LTC3':
        return [{ name: 'Tri-Color Light', type: 'RELAY' }];
      case 'CONS':
        return [{ name: 'Home Console', type: 'RELAY' }];
      case 'CUST':
      default:
        return [{ name: 'Relay 1', type: 'RELAY' }];
    }
  }

  /**
   * Provisions a physical device, creates parent record and child endpoints
   */
  public async provisionDevice(dto: ProvisionDeviceDTO): Promise<{
    device: DeviceRecord;
    endpoints: DeviceEndpointRecord[];
    deviceId: string;
  }> {
    const mac4 = (dto.mac4 || 'BC88').toUpperCase().slice(-4);
    const modelCode = (dto.modelCode || 'TP8').toUpperCase();
    const deviceId = (dto.deviceId && dto.deviceId.trim())
      ? dto.deviceId.trim()
      : this.generateDeviceId(mac4, modelCode);

    const client = await db.connect();
    let deviceRecord: DeviceRecord;
    const endpoints: DeviceEndpointRecord[] = [];
    try {
      await client.query('BEGIN');
      const targetHomeId = dto.homeId;

      // Verify a supplied room belongs to the selected location.
      let targetRoomId = dto.roomId || null;
      if (targetRoomId) {
        const roomCheck = await client.query(`SELECT id FROM rooms WHERE id::text = $1 AND home_id = $2`, [targetRoomId, targetHomeId]);
        if (roomCheck.rows.length === 0) {
          throw new Error('Room does not belong to this location');
        }
      }

      if (!targetRoomId && targetHomeId) {
        // Check if a default 'Living room' exists or create it
        const defaultRoom = await client.query(
          `SELECT id FROM rooms WHERE home_id = $1 AND LOWER(name) = 'living room' LIMIT 1`,
          [targetHomeId]
        );
        if (defaultRoom.rows.length > 0) {
          targetRoomId = defaultRoom.rows[0].id;
        } else {
          const createdRoom = await client.query(
            `INSERT INTO rooms (home_id, name) VALUES ($1, 'Living room') RETURNING id`,
            [targetHomeId]
          );
          targetRoomId = createdRoom.rows[0].id;
        }
      }

      // 1. Insert or Update Parent Device Record
      const deviceQuery = `
        INSERT INTO devices (
          home_id, room_id, device_id, mac_4, model_code, custom_name, icon, wifi_ssid, ip_address, firmware_version, is_online
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
        ON CONFLICT (device_id) DO UPDATE SET
          room_id = EXCLUDED.room_id,
          custom_name = EXCLUDED.custom_name,
          icon = EXCLUDED.icon,
          wifi_ssid = EXCLUDED.wifi_ssid,
          ip_address = COALESCE(EXCLUDED.ip_address, devices.ip_address),
          updated_at = CURRENT_TIMESTAMP
        WHERE devices.home_id = EXCLUDED.home_id
        RETURNING *;
      `;
      const deviceValues = [
        targetHomeId,
        targetRoomId,
        deviceId,
        mac4,
        modelCode,
        dto.customName.trim(),
        dto.icon || null,
        dto.wifiSsid.trim(),
        dto.ipAddress || null,
        dto.firmwareVersion || 'v1.2.4-neuro',
      ];

      const deviceResult = await client.query(deviceQuery, deviceValues);
      deviceRecord = deviceResult.rows[0];
      if (!deviceRecord) throw new Error('Device already belongs to another location');

      // 2. Insert Child Endpoints
      const endpointConfigs = this.getEndpointsForModel(modelCode);

      for (let i = 0; i < endpointConfigs.length; i++) {
        const ep = endpointConfigs[i];
        const epQuery = `
          INSERT INTO device_endpoints (
            device_id, endpoint_index, name, endpoint_type, state, is_favorite
          ) VALUES ($1, $2, $3, $4, $5, false)
          ON CONFLICT (device_id, endpoint_index) DO UPDATE SET
            name = EXCLUDED.name,
            endpoint_type = EXCLUDED.endpoint_type
          RETURNING *;
        `;
        const epResult = await client.query(epQuery, [
          deviceId,
          i + 1,
          ep.name,
          ep.type,
          JSON.stringify({ status: 'OFF' }),
        ]);
        endpoints.push(epResult.rows[0]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return {
      device: deviceRecord,
      endpoints,
      deviceId,
    };
  }

  public async getDevicesByHome(homeId: string, userId?: string): Promise<Array<DeviceRecord & { endpoints: DeviceEndpointRecord[] }>> {
    // Automatically mark devices offline if last_seen_at is older than 12 seconds
    await db.query(
      `UPDATE devices 
       SET is_online = false 
       WHERE is_online = true AND (last_seen_at IS NULL OR last_seen_at < CURRENT_TIMESTAMP - INTERVAL '12 seconds')`
    ).catch(() => {});

    const devQuery = `SELECT d.*, ($2::uuid IS NULL OR h.owner_id = $2 OR m.role = 'control') AS can_control
      FROM devices d JOIN homes h ON h.id = d.home_id
      LEFT JOIN home_members m ON m.home_id = h.id AND m.user_id = $2
      WHERE d.home_id = $1 AND ($2::uuid IS NULL OR h.owner_id = $2 OR (m.user_id IS NOT NULL AND ${memberDeviceScope}))
      ORDER BY d.created_at DESC`;
    const devResult = await db.query(devQuery, [homeId, userId ?? null]);
    const devices: DeviceRecord[] = devResult.rows;

    const list = [];
    for (const dev of devices) {
      const epResult = await db.query(
        `SELECT * FROM device_endpoints WHERE device_id = $1 ORDER BY endpoint_index ASC`,
        [dev.device_id]
      );
      list.push({
        ...dev,
        endpoints: epResult.rows,
      });
    }
    return list;
  }

  /**
   * Processes incoming hardware telemetry published on nt/v1/{deviceId}/stat/telemetry
   * Example payload:
   * {
   *   "deviceId": "{deviceId}",
   *   "type": "switch_8",
   *   "online": true,
   *   "rssi": -55,
   *   "switches": { "1": false, "2": true, ... }
   * }
   */
  public async handleTelemetryUpdate(deviceId: string, data: {
    switches?: Record<string, boolean>;
    readings?: unknown;
    online?: boolean;
    rssi?: number;
    type?: string;
    voltage?: number;
    current?: number;
    power?: number;
    apparent_power?: number;
    reactive_power?: number;
    power_factor?: number;
    frequency?: number;
    energy_kwh?: number;
    energy_wh?: number;
    relay?: boolean;
    trip_reason?: string;
    alerts?: Record<string, any>;
  }): Promise<void> {
    try {
      const isOnline = typeof data.online === 'boolean' ? data.online : true;
      const rssi = typeof data.rssi === 'number' ? data.rssi : null;
      const switches = normalizeSwitches(data.switches ?? (data as any).payload ?? (data as any).state ?? data);
      const readings = normalizeReadings(data.readings);

      // Energy meter specific telemetry parsing
      const voltage = typeof data.voltage === 'number' ? data.voltage : null;
      const current = typeof data.current === 'number' ? data.current : null;
      const power = typeof data.power === 'number' ? data.power : null;
      const apparentPower = typeof data.apparent_power === 'number' ? data.apparent_power : null;
      const reactivePower = typeof data.reactive_power === 'number' ? data.reactive_power : null;
      const powerFactor = typeof data.power_factor === 'number' ? data.power_factor : null;
      const frequency = typeof data.frequency === 'number' ? data.frequency : null;
      const energyKwh = typeof data.energy_kwh === 'number' ? data.energy_kwh : null;
      const energyWh = typeof data.energy_wh === 'number' ? data.energy_wh : null;
      
      let relayVal: boolean | null = null;
      if (typeof data.relay === 'boolean') {
        relayVal = Boolean(data.relay);
        if (switches['1'] === undefined) {
          switches['1'] = relayVal;
        }
      } else if (switches['1'] !== undefined) {
        relayVal = Boolean(switches['1']);
      }

      const tripReason = typeof data.trip_reason === 'string' ? data.trip_reason : null;
      const alerts = (typeof data.alerts === 'object' && data.alerts !== null) ? data.alerts : null;

      // 1. Update devices table in PostgreSQL with switch state & full energy meter metrics
      await db.query(
        `UPDATE devices 
         SET switches = COALESCE(switches, '{}'::jsonb) || $1::jsonb,
             is_online = $2,
             rssi = COALESCE($3, rssi),
             voltage = COALESCE($4, voltage),
             current = COALESCE($5, current),
             power = COALESCE($6, power),
             apparent_power = COALESCE($7, apparent_power),
             reactive_power = COALESCE($8, reactive_power),
             power_factor = COALESCE($9, power_factor),
             frequency = COALESCE($10, frequency),
             energy_kwh = COALESCE($11, energy_kwh),
             energy_wh = COALESCE($12, energy_wh),
             relay = COALESCE($13, relay),
             trip_reason = COALESCE($14, trip_reason),
             alerts = CASE WHEN $15::jsonb IS NOT NULL THEN $15::jsonb ELSE alerts END,
             energy_data = COALESCE(energy_data, '{}'::jsonb) || $16::jsonb,
             last_seen_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE device_id = $17`,
        [
          JSON.stringify(switches),
          isOnline,
          rssi,
          voltage,
          current,
          power,
          apparentPower,
          reactivePower,
          powerFactor,
          frequency,
          energyKwh,
          energyWh,
          relayVal,
          tripReason,
          alerts ? JSON.stringify(alerts) : null,
          JSON.stringify(data),
          deviceId,
        ]
      );

      // 2. Update device_endpoints table for each switch channel
      for (const [chStr, stateVal] of Object.entries(switches)) {
        const chNum = parseInt(chStr, 10);
        if (!isNaN(chNum)) {
          const epState = JSON.stringify({
            status: stateVal ? 'ON' : 'OFF',
            power: stateVal,
          });
          await db.query(
            `UPDATE device_endpoints 
             SET state = $1::jsonb 
             WHERE device_id = $2 AND endpoint_index = $3`,
            [epState, deviceId, chNum]
          );
        }
      }

      if (readings.length) {
        await db.query(
          `UPDATE device_endpoints e SET state = e.state || jsonb_build_object(
               'reading', to_jsonb(r) || jsonb_build_object('reportedAt', CURRENT_TIMESTAMP))
           FROM jsonb_to_recordset($2::jsonb) AS r(channel int, value jsonb, unit text)
           WHERE e.device_id = $1 AND e.endpoint_index = r.channel AND e.endpoint_type IN ('SENSOR', 'PHASE')`,
          [deviceId, JSON.stringify(readings)]
        );
      }

      if (Object.keys(switches).length) await markObserved(deviceId, switches);

      // 3. Broadcast to all connected WebSocket clients in real time
      const wsBroadcastPayload = {
        deviceId,
        switches,
        readings,
        is_online: isOnline,
        rssi,
        last_seen_at: new Date().toISOString(),
        ...(voltage !== null ? { voltage } : {}),
        ...(current !== null ? { current } : {}),
        ...(power !== null ? { power } : {}),
        ...(apparentPower !== null ? { apparent_power: apparentPower } : {}),
        ...(reactivePower !== null ? { reactive_power: reactivePower } : {}),
        ...(powerFactor !== null ? { power_factor: powerFactor } : {}),
        ...(frequency !== null ? { frequency } : {}),
        ...(energyKwh !== null ? { energy_kwh: energyKwh } : {}),
        ...(energyWh !== null ? { energy_wh: energyWh } : {}),
        ...(relayVal !== null ? { relay: relayVal } : {}),
        ...(tripReason !== null ? { trip_reason: tripReason } : {}),
        ...(alerts !== null ? { alerts } : {}),
      };

      socketManager.broadcastDeviceUpdate(deviceId, wsBroadcastPayload);
    } catch (err) {
      console.error(`❌ Failed to process telemetry update for ${deviceId}:`, err);
    }
  }

  public async resetEnergy(deviceId: string): Promise<void> {
    const result = await db.query(
      `SELECT 1 FROM devices WHERE device_id = $1 AND model_code IN ('EM1', 'EMS1', 'EM3', 'EMS3')
       AND is_online = true AND last_seen_at > NOW() - INTERVAL '12 seconds'`,
      [deviceId]
    );
    if (!result.rowCount) throw new Error('An online energy meter is required');
    await emqxService.sendEnergyResetCommand(deviceId);
  }

  /**
   * Processes incoming hardware heartbeat published on devices/{deviceId}/heartbeat
   */
  public async handleHeartbeat(deviceId: string, data: {
    online?: boolean;
    rssi?: number;
    uptime_sec?: number;
  }): Promise<void> {
    try {
      const isOnline = data.online !== undefined ? data.online : true;
      const rssi = typeof data.rssi === 'number' ? data.rssi : null;
      const uptime = typeof data.uptime_sec === 'number' ? data.uptime_sec : null;

      await db.query(
        `UPDATE devices 
         SET is_online = $1,
             rssi = COALESCE($2, rssi),
             uptime_sec = COALESCE($3, uptime_sec),
             last_seen_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE device_id = $4`,
        [isOnline, rssi, uptime, deviceId]
      );

      socketManager.broadcastDeviceUpdate(deviceId, {
        deviceId,
        is_online: isOnline,
        rssi,
        uptime_sec: uptime,
      });
      console.log(`💓 [HEARTBEAT] Device ${deviceId} online:`, isOnline, `RSSI:`, rssi);
    } catch (err) {
      console.error(`❌ Failed to process heartbeat for ${deviceId}:`, err);
    }
  }

  /**
   * Controls a specific switch channel (1-8) for a device.
   * Publishes command envelope to devices/{deviceId}/set via MQTT and updates DB + WebSockets.
   */
  public async controlSwitch(
    identifier: string,
    channel: number,
    action: 'on' | 'off' | 'toggle',
    runId?: string
  ): Promise<{
    deviceId: string;
    channel: number;
    state: boolean;
    switches: Record<string, boolean>;
  }> {
    if (!Number.isInteger(channel) || channel < 1 || !['on', 'off', 'toggle'].includes(action)) {
      throw new Error('Invalid switch command');
    }
    // 1. Resolve the control channel from the registered device capabilities.
    const devRes = await db.query(
      `SELECT d.id, d.device_id, d.switches, d.is_online, d.last_seen_at
       FROM devices d JOIN device_endpoints e ON e.device_id = d.device_id
       WHERE (d.id::text = $1 OR d.device_id = $1) AND e.endpoint_type = 'RELAY'
         AND CASE WHEN d.model_code IN ('EMS1', 'EMS3') THEN $2::int = 1 ELSE e.endpoint_index = $2 END
       LIMIT 1`,
      [identifier, channel]
    );
    if (devRes.rows.length === 0) {
      throw new Error(`Device ${identifier} not found in database`);
    }

    const device = devRes.rows[0];
    const isOnline = device.is_online && device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() <= 12000;
    const deviceId = device.device_id;
    const currentSwitches = (device.switches as Record<string, boolean>) || {};
    const currentVal = Boolean(currentSwitches[String(channel)]);

    // Determine target boolean state
    let targetState = false;
    if (action === 'on') targetState = true;
    else if (action === 'off') targetState = false;
    else targetState = !currentVal;

    // 2. Publish to EMQX MQTT using official hardware specification
    const { rows } = await db.query(
      'INSERT INTO device_activity (device_id, run_id, channel, target) VALUES ($1, $2, $3, $4) RETURNING id',
      [device.id, runId ?? null, channel, targetState]
    );
    try {
      if (!isOnline) throw new Error('Device offline');
      await emqxService.sendSwitchCommand(deviceId, channel, targetState);
    } catch (error) {
      const reason = isOnline ? 'The broker did not accept the command' : 'Device offline';
      await db.query("UPDATE device_activity SET status = 'failed', failure = $2 WHERE id = $1", [rows[0].id, reason]);
      throw new Error(reason, { cause: error });
    }
    await db.query("UPDATE device_activity SET status = 'sent' WHERE id = $1", [rows[0].id]);

    // Confirmed state comes from firmware telemetry. This response describes the requested command.
    const updatedSwitches = { ...currentSwitches, [String(channel)]: targetState };

    return {
      deviceId,
      channel,
      state: targetState,
      switches: updatedSwitches,
    };
  }

  /**
   * Updates switch names and icons across PostgreSQL and broadcasts to all clients
   */
  public async updateSwitchConfigs(
    deviceId: string,
    configs: Array<{ index: number; name: string; iconPath?: string }>
  ): Promise<any> {
    try {
      // 1. Update devices table switch_configs
      await db.query(
        `UPDATE devices 
         SET switch_configs = $1::jsonb,
             updated_at = CURRENT_TIMESTAMP 
         WHERE device_id = $2 OR id::text = $2`,
        [JSON.stringify(configs), deviceId]
      );

      // 2. Update device_endpoints rows
      for (const item of configs) {
        const endpointIndex = item.index + 1;
        if (item.name) {
          await db.query(
            `UPDATE device_endpoints 
             SET name = $1, icon = $2 
             WHERE (device_id = $3 OR device_id = (SELECT device_id FROM devices WHERE id::text = $3))
               AND endpoint_index = $4`,
            [item.name, item.iconPath || null, deviceId, endpointIndex]
          ).catch(() => {});
        }
      }

      // 3. Broadcast to all WebSocket clients (mobile app + web browser)
      socketManager.broadcastDeviceUpdate(deviceId, {
        deviceId,
        switchConfigs: configs,
      });

      console.log(`🔄 [SWITCH CONFIGS SYNC] Updated switch configs for device ${deviceId} and broadcasted`);
      return {
        success: true,
        deviceId,
        switchConfigs: configs,
      };
    } catch (err) {
      console.error(`❌ Failed to update switch configs for device ${deviceId}:`, err);
      throw err;
    }
  }
}

export const deviceService = new DeviceService();
