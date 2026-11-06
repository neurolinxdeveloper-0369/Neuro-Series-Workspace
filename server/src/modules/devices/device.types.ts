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
