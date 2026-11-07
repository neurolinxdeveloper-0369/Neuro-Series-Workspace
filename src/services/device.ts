import { api } from './api';

export interface SmartDevice {
  id: string;
  name: string;
  room: string;
  type: 'switch' | 'light' | 'thermostat' | 'fan' | 'sensor';
  state: {
    power?: boolean;
    brightness?: number;
    colorTemperature?: number;
    targetTemperature?: number;
    currentTemperature?: number;
    humidity?: number;
    speed?: number;
    online?: boolean;
    [key: string]: unknown;
  };
  lastSeen?: string;
}

export interface ProvisionInput {
  homeId: string;
  roomId?: string | null;
  modelCode: string;
  mac4: string;
  customName: string;
  wifiSsid: string;
  wifiPassword?: string;
  firmwareVersion?: string;
  ipAddress?: string;
}

export interface ProvisionResult {
  success: boolean;
  deviceId: string;
  mqttHost: string;
  mqttPort: number;
  mqttUsername: string;
  mqttPassword: string;
  device: {
    id: string;
    device_id: string;
    custom_name: string;
    model_code: string;
    mac_4: string;
    wifi_ssid: string;
    firmware_version: string;
  };
  endpoints: Array<{
    id: string;
    endpoint_index: number;
    name: string;
    endpoint_type: string;
  }>;
}

export const deviceApi = {
  getDevices: async (): Promise<SmartDevice[]> => {
    const res = await api.get<{ success: boolean; devices: SmartDevice[] }>('/devices');
    return res.success && Array.isArray(res.devices) ? res.devices : [];
  },

  getDevicesByHome: async (homeId: string): Promise<any[]> => {
    const res = await api.get<{ success: boolean; devices: any[] }>(`/devices/home/${homeId}`);
    return res.success && Array.isArray(res.devices) ? res.devices : [];
  },

  provisionDevice: async (input: ProvisionInput): Promise<ProvisionResult> => {
    const res = await api.post<ProvisionResult>('/devices/provision', input);
    if (!res.success || !res.deviceId) {
      throw new Error('Failed to provision device');
    }
    return res;
  },

  addDevice: async (input: { name: string; room?: string; type?: SmartDevice['type']; homeId?: string }): Promise<SmartDevice> => {
    const res = await api.post<{ success: boolean; device: SmartDevice }>('/devices', input);
    if (!res.success || !res.device) {
      throw new Error('Failed to add device');
    }
    return res.device;
  },

  updateDeviceState: async (id: string, updates: Partial<SmartDevice['state']>): Promise<SmartDevice> => {
    const res = await api.patch<{ success: boolean; device: SmartDevice }>(`/devices/${id}/state`, updates);
    if (!res.success || !res.device) {
      throw new Error('Failed to update device state');
    }
    return res.device;
  },
};
