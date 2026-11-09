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
    const deviceId = this.generateDeviceId(mac4, modelCode);

    // 1. Insert Parent Device Record
    const deviceQuery = `
      INSERT INTO devices (
        home_id, room_id, device_id, mac_4, model_code, custom_name, icon, wifi_ssid, ip_address, firmware_version, is_online
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      RETURNING *;
    `;
    const deviceValues = [
      dto.homeId,
      dto.roomId || null,
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
      mqttHost: '50.6.45.177',
      mqttPort: 1887,
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
}

export const deviceService = new DeviceService();
