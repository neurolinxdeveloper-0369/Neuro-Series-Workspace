import { api } from './api';

export interface DeviceReading {
  channel: number;
  value: number | boolean;
  unit?: string;
  reportedAt?: string;
}

export interface DeviceEndpoint {
  id: string;
  endpoint_index: number;
  name: string;
  endpoint_type: 'RELAY' | 'SENSOR' | 'PHASE';
  state?: { reading?: DeviceReading };
}

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
  endpoints?: DeviceEndpoint[];
  last_seen_at?: string;
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
  rssi?: number;
  trip_reason?: string;
  alerts?: {
    message?: string;
    over_current?: boolean;
    under_voltage?: boolean;
    over_voltage?: boolean;
    low_pf?: boolean;
    freq_error?: boolean;
    reverse_power?: boolean;
  };
  energy_data?: any;
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
  verificationFrom: string;
  success: boolean;
  deviceId: string;
  device: Device;
  endpoints: DeviceEndpoint[];
}

export interface PairingConfig {
  mqttHost: string;
  mqttPort: number;
  mqttUsername: string;
  mqttPassword: string;
}

export const deviceApi = {
  getPairingConfig: async (homeId: string): Promise<PairingConfig> => {
    const path = `/devices/home/${encodeURIComponent(homeId)}/pairing-config`;
    return api.get<PairingConfig>(path);
  },

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

  getPairingStatus: async (id: string, after: string): Promise<{ online: boolean; lastSeenAt: string | null }> => {
    const path = `/devices/${encodeURIComponent(id)}/pairing-status?after=${encodeURIComponent(after)}`;
    return api.get<{ online: boolean; lastSeenAt: string | null }>(path, { timeoutMs: 2500 });
  },

  updateDetails: async (id: string, name: string, roomId: string | null) => {
    const result = await api.patch<{ success: boolean; device: { custom_name: string; room_id: string | null } }>(
      `/devices/${encodeURIComponent(id)}`, { name, roomId }
    );
    return result.device;
  },

  removeDevice: async (id: string): Promise<void> => {
    await api.del(`/devices/${encodeURIComponent(id)}`);
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

  resetEnergy: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.post<{ success: boolean; message: string }>(`/devices/${id}/reset-energy`, {});
  },
};
