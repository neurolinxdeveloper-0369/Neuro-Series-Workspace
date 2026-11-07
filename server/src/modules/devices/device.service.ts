import { emqxService } from '../mqtt/emqx.client.js';
import { socketManager } from '../websocket/socket.server.js';
import type { SmartDevice } from './device.types.js';

class DeviceService {
  // In-memory active device cache (can be persisted to PostgreSQL)
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

  public getDevices(): SmartDevice[] {
    return Array.from(this.devices.values());
  }

  public getDeviceById(id: string): SmartDevice | undefined {
    return this.devices.get(id);
  }

  public async updateDeviceState(id: string, updates: Partial<SmartDevice['state']>): Promise<SmartDevice> {
    const device = this.devices.get(id);
    if (!device) {
      throw new Error(`Device ${id} not found`);
    }

    // Merge state
    device.state = { ...device.state, ...updates };
    device.lastSeen = new Date().toISOString();
    this.devices.set(id, device);

    // 1. Publish command to EMQX MQTT Broker (for hardware devices)
    try {
      await emqxService.publishCommand(id, updates);
    } catch (err) {
      console.warn(`MQTT Publish warning for ${id}:`, err);
    }

    // 2. Broadcast immediately over WebSockets to all connected frontends
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
