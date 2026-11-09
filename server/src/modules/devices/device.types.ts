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

export interface DeviceRecord {
  id: string;
  home_id: string;
  room_id: string | null;
  device_id: string; // e.g. 'nt8k-BC88-TP8'
  mac_4: string;
  model_code: string;
  custom_name: string;
  icon?: string | null;
  wifi_ssid: string;
  rssi?: number | null;
  ip_address?: string | null;
  firmware_version?: string | null;
  is_online: boolean;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceEndpointRecord {
  id: string;
  device_id: string;
  endpoint_index: number;
  name: string;
  endpoint_type: 'RELAY' | 'PHASE' | 'SENSOR';
  state: Record<string, unknown>;
  is_favorite: boolean;
  created_at: string;
}

export interface ProvisionDeviceDTO {
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
