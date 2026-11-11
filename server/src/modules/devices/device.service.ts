import { emqxService } from '../mqtt/emqx.client.js';
import { socketManager } from '../websocket/socket.server.js';
import { db } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import type { SmartDevice, DeviceRecord, DeviceEndpointRecord, ProvisionDeviceDTO } from './device.types.js';

interface EndpointConfig {
  name: string;
  type: 'RELAY' | 'PHASE' | 'SENSOR';
}

class DeviceService {
  private devices: Map<string, SmartDevice> = new Map([
    [
      'light_living_room',
      {
        id: 'light_living_room',
        name: 'Ceiling Light',
        room: 'Living Room',
        type: 'light',
        state: { power: true, brightness: 80, online: true },
      },
    ],
    [
      'ac_bedroom',
      {
        id: 'ac_bedroom',
        name: 'Air Conditioner',
        room: 'Master Bedroom',
        type: 'thermostat',
        state: { power: true, targetTemperature: 22, currentTemperature: 24, online: true },
      },
    ],
    [
      'fan_study',
      {
        id: 'fan_study',
        name: 'Ceiling Fan',
        room: 'Study Room',
        type: 'fan',
        state: { power: false, speed: 2, online: true },
      },
    ],
  ]);

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
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS uptime_sec INT DEFAULT NULL;

      CREATE TABLE IF NOT EXISTS device_endpoints (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
          endpoint_index INT NOT NULL,
          name VARCHAR(100) NOT NULL,
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
      }, 2000);
    } catch (err) {
      console.error('❌ Failed to initialize devices tables:', err);
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
    mqttHost: string;
    mqttPort: number;
    mqttUsername: string;
    mqttPassword: string;
    deviceId: string;
  }> {
    const mac4 = (dto.mac4 || 'BC88').toUpperCase().slice(-4);
    const modelCode = (dto.modelCode || 'TP8').toUpperCase();
    const deviceId = (dto.deviceId && dto.deviceId.trim())
      ? dto.deviceId.trim()
      : this.generateDeviceId(mac4, modelCode);

    // Ensure valid home_id exists in database to satisfy foreign key constraint
    let targetHomeId = dto.homeId;
    if (!targetHomeId || targetHomeId === '00000000-0000-0000-0000-000000000000') {
      const existingHome = await db.query(`SELECT id FROM homes ORDER BY created_at ASC LIMIT 1`);
      if (existingHome.rows.length > 0) {
        targetHomeId = existingHome.rows[0].id;
      } else {
        // Find or create default user for the home
        let userId: string;
        const userRes = await db.query(`SELECT id FROM users LIMIT 1`);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        } else {
          const newUser = await db.query(`
            INSERT INTO users (email, full_name, auth_provider)
            VALUES ('owner@neurolinx.in', 'Home Owner', 'email')
            RETURNING id;
          `);
          userId = newUser.rows[0].id;
        }

        const newHome = await db.query(`
          INSERT INTO homes (owner_id, name, property_type, default_wifi_ssid)
          VALUES ($1, 'My Home', 'Apartment', $2)
          RETURNING id;
        `, [userId, dto.wifiSsid || 'Home Wi-Fi']);
        targetHomeId = newHome.rows[0].id;
      }
    } else {
      // Validate that the provided homeId actually exists
      const homeCheck = await db.query(`SELECT id FROM homes WHERE id = $1`, [targetHomeId]);
      if (homeCheck.rows.length === 0) {
        const anyHome = await db.query(`SELECT id FROM homes ORDER BY created_at ASC LIMIT 1`);
        if (anyHome.rows.length > 0) {
          targetHomeId = anyHome.rows[0].id;
        }
      }
    }

    // Ensure valid room_id exists or create default room
    let targetRoomId = dto.roomId || null;
    if (targetRoomId) {
      const roomCheck = await db.query(`SELECT id FROM rooms WHERE id = $1`, [targetRoomId]);
      if (roomCheck.rows.length === 0) {
        targetRoomId = null;
      }
    }

    if (!targetRoomId && targetHomeId) {
      // Check if a default 'Living room' exists or create it
      const defaultRoom = await db.query(
        `SELECT id FROM rooms WHERE home_id = $1 AND LOWER(name) = 'living room' LIMIT 1`,
        [targetHomeId]
      );
      if (defaultRoom.rows.length > 0) {
        targetRoomId = defaultRoom.rows[0].id;
      } else {
        const createdRoom = await db.query(
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      ON CONFLICT (device_id) DO UPDATE SET
        home_id = EXCLUDED.home_id,
        room_id = EXCLUDED.room_id,
        custom_name = EXCLUDED.custom_name,
        icon = EXCLUDED.icon,
        wifi_ssid = EXCLUDED.wifi_ssid,
        ip_address = EXCLUDED.ip_address,
        is_online = true,
        updated_at = CURRENT_TIMESTAMP
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
      dto.ipAddress || '192.168.4.1',
      dto.firmwareVersion || 'v1.2.4-neuro',
    ];

    const deviceResult = await db.query(deviceQuery, deviceValues);
    const deviceRecord: DeviceRecord = deviceResult.rows[0];

    // 2. Insert Child Endpoints
    const endpointConfigs = this.getEndpointsForModel(modelCode);
    const endpoints: DeviceEndpointRecord[] = [];

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
      const epResult = await db.query(epQuery, [
        deviceId,
        i + 1,
        ep.name,
        ep.type,
        JSON.stringify({ status: 'OFF' }),
      ]);
      endpoints.push(epResult.rows[0]);
    }

    // 3. Keep in-memory cache synchronized
    this.devices.set(deviceId, {
      id: deviceId,
      name: deviceRecord.custom_name,
      room: 'Living Room',
      type: modelCode.startsWith('TP') || modelCode.startsWith('SS') ? 'switch' : 'light',
      state: { power: false, online: true },
      lastSeen: new Date().toISOString(),
    });

    // 4. Return provision response with MQTT broker coordinates
    return {
      device: deviceRecord,
      endpoints,
      deviceId,
      mqttHost: ENV.MQTT_PUBLIC_HOST || 'api.neurolinx.in',
      mqttPort: ENV.MQTT_PUBLIC_PORT || 1887,
      mqttUsername: ENV.MQTT_USERNAME || 'neuro_device_user',
      mqttPassword: ENV.MQTT_PASSWORD || 'NeuroSeriesEmqx2026!',
    };
  }

  public getDevices(): SmartDevice[] {
    return Array.from(this.devices.values());
  }

  public getDeviceById(id: string): SmartDevice | undefined {
    return this.devices.get(id);
  }

  public async getDevicesByHome(homeId: string): Promise<Array<DeviceRecord & { endpoints: DeviceEndpointRecord[] }>> {
    // Automatically mark devices offline if last_seen_at is older than 12 seconds
    await db.query(
      `UPDATE devices 
       SET is_online = false 
       WHERE is_online = true AND (last_seen_at IS NULL OR last_seen_at < CURRENT_TIMESTAMP - INTERVAL '12 seconds')`
    ).catch(() => {});

    const devQuery = `SELECT * FROM devices WHERE home_id = $1 ORDER BY created_at DESC`;
    const devResult = await db.query(devQuery, [homeId]);
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

  public async updateDeviceState(id: string, updates: Partial<SmartDevice['state']>): Promise<SmartDevice> {
    const device = this.devices.get(id);
    if (!device) {
      throw new Error(`Device ${id} not found`);
    }

    device.state = { ...device.state, ...updates };
    device.lastSeen = new Date().toISOString();
    this.devices.set(id, device);

    try {
      await emqxService.publishCommand(id, updates);
    } catch (err) {
      console.warn(`MQTT Publish warning for ${id}:`, err);
    }

    socketManager.broadcastDeviceUpdate(id, device.state);
    return device;
  }

  public addDevice(data: { name: string; room?: string; type?: SmartDevice['type']; homeId?: string }): SmartDevice {
    const id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newDevice: SmartDevice = {
      id,
      name: data.name.trim(),
      room: data.room?.trim() || 'Living room',
      type: data.type || 'light',
      state: {
        power: false,
        online: true,
      },
      lastSeen: new Date().toISOString(),
    };
    this.devices.set(id, newDevice);
    socketManager.broadcastDeviceUpdate(id, newDevice.state);
    return newDevice;
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
    online?: boolean;
    rssi?: number;
    type?: string;
  }): Promise<void> {
    try {
      const isOnline = data.online !== undefined ? data.online : true;
      const rssi = typeof data.rssi === 'number' ? data.rssi : null;
      let switches = data.switches || (data as any).payload || (typeof (data as any).state === 'object' ? (data as any).state : null) || {};
      if (typeof switches !== 'object' || switches === null) {
        switches = {};
      }
      if (Object.keys(switches).length === 0) {
        const numericKeys = Object.keys(data).filter(k => !isNaN(parseInt(k, 10)));
        if (numericKeys.length > 0) {
          switches = {};
          for (const k of numericKeys) {
            switches[k] = (data as any)[k];
          }
        }
      }

      // 1. Update devices table in PostgreSQL
      await db.query(
        `UPDATE devices 
         SET switches = COALESCE(switches, '{}'::jsonb) || $1::jsonb,
             is_online = $2,
             rssi = COALESCE($3, rssi),
             last_seen_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE device_id = $4`,
        [JSON.stringify(switches), isOnline, rssi, deviceId]
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

      // 3. Broadcast to all connected WebSocket clients in real time
      socketManager.broadcastDeviceUpdate(deviceId, {
        deviceId,
        switches,
        is_online: isOnline,
        rssi,
        last_seen_at: new Date().toISOString(),
      });
      console.log(`✅ [DB & WS UPDATED] Hardware Telemetry for ${deviceId}:`, switches);
    } catch (err) {
      console.error(`❌ Failed to process telemetry update for ${deviceId}:`, err);
    }
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
    action: 'on' | 'off' | 'toggle'
  ): Promise<{
    deviceId: string;
    channel: number;
    state: boolean;
    switches: Record<string, boolean>;
  }> {
    // 1. Fetch current device from database
    const devRes = await db.query(
      `SELECT id, device_id, model_code, switches, is_online, last_seen_at FROM devices WHERE id::text = $1 OR device_id = $1 LIMIT 1`,
      [identifier]
    );
    if (devRes.rows.length === 0) {
      throw new Error(`Device ${identifier} not found in database`);
    }

    const device = devRes.rows[0];
    const isOnline = Boolean(device.is_online) && device.last_seen_at && (Date.now() - new Date(device.last_seen_at).getTime() <= 12000);
    if (!isOnline) {
      throw new Error(`Device ${device.device_id} is offline. Switches cannot be controlled.`);
    }

    const deviceId = device.device_id;
    const currentSwitches = (device.switches as Record<string, boolean>) || {};
    const currentVal = Boolean(currentSwitches[String(channel)]);

    // Determine target boolean state
    let targetState = false;
    if (action === 'on') targetState = true;
    else if (action === 'off') targetState = false;
    else targetState = !currentVal;

    // 2. Publish to EMQX MQTT using official hardware specification
    await emqxService.sendSwitchCommand(deviceId, channel, targetState);

    // 3. Update database
    const updatedSwitches = {
      ...currentSwitches,
      [String(channel)]: targetState,
    };

    await db.query(
      `UPDATE devices 
       SET switches = $1::jsonb,
           updated_at = CURRENT_TIMESTAMP 
       WHERE device_id = $2`,
      [JSON.stringify(updatedSwitches), deviceId]
    );

    // Update endpoint record in device_endpoints table
    const epState = JSON.stringify({
      status: targetState ? 'ON' : 'OFF',
      power: targetState,
    });
    await db.query(
      `UPDATE device_endpoints 
       SET state = $1::jsonb 
       WHERE device_id = $2 AND endpoint_index = $3`,
      [epState, deviceId, channel]
    );

    // 4. Broadcast via WebSocket
    socketManager.broadcastDeviceUpdate(deviceId, {
      deviceId,
      switches: updatedSwitches,
      channel,
      state: targetState,
    });

    return {
      deviceId,
      channel,
      state: targetState,
      switches: updatedSwitches,
    };
  }
}

export const deviceService = new DeviceService();
