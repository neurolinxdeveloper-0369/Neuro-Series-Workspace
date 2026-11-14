import { api } from './api';

export interface Device {
  id: string;
  home_id: string;
  room_id: string | null;
  model_code: string;
  mac_4: string;
  custom_name: string;
  icon?: string;
  device_id: string;
  ip_address?: string;
  firmware_version?: string;
  is_online?: boolean;
  switches?: Record<string, boolean>;
  switch_configs?: Array<{ index: number; name: string; iconPath?: string }>;
  endpoints?: any[];
  created_at?: string;
  updated_at?: string;
}

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
  deviceId?: string;
  homeId: string;
  roomId?: string | null;
  modelCode: string;
  mac4: string;
  customName: string;
  icon?: string;
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
    // 1. Check if on native Android bridge
    const androidBridge = typeof window !== 'undefined' ? (window as any).AndroidWifiBridge : null;
    if (androidBridge?.nativeApiCall) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuro_auth_token') || '' : '';
      const rawRes = androidBridge.nativeApiCall(
        'https://neurolinx.in/neuro-series/api/devices/provision',
        'POST',
        JSON.stringify(input),
        token
      );
      const parsed = JSON.parse(rawRes || '{}');
      if (parsed.ok || (parsed.status >= 200 && parsed.status < 300)) {
        const bodyData = typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body;
        if (bodyData && bodyData.success && bodyData.deviceId) {
          return bodyData;
        }
        throw new Error(bodyData?.error || 'Backend rejected device provisioning');
      } else {
        throw new Error(parsed.error || `Native API call failed with status ${parsed.status}`);
      }
    }

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

  controlSwitch: async (id: string, channel: number, action: 'on' | 'off' | 'toggle'): Promise<{
    success: boolean;
    deviceId: string;
    channel: number;
    state: boolean;
    switches: Record<string, boolean>;
  }> => {
    return api.post<{
      success: boolean;
      deviceId: string;
      channel: number;
      state: boolean;
      switches: Record<string, boolean>;
    }>(`/devices/${id}/action`, { channel, action });
  },

  updateSwitchConfigs: async (id: string, configs: Array<{ index: number; name: string; iconPath?: string }>): Promise<{
    success: boolean;
    deviceId: string;
    switchConfigs: Array<{ index: number; name: string; iconPath?: string }>;
  }> => {
    return api.put<{
      success: boolean;
      deviceId: string;
      switchConfigs: Array<{ index: number; name: string; iconPath?: string }>;
    }>(`/devices/${id}/switches/config`, { configs });
  },
};
