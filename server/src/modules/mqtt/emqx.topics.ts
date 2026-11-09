import { ENV } from '../../config/env.js';

export const MQTT_TOPICS = {
  // Official Hardware Telemetry published by ESP32 / Firmware
  // Example: nt/v1/nt8k-BC88-TP8/stat/telemetry
  HARDWARE_TELEMETRY: 'nt/v1/+/stat/telemetry',

  // Official Hardware Heartbeat
  // Example: devices/nt8k-BC88-TP8/heartbeat
  HARDWARE_HEARTBEAT: 'devices/+/heartbeat',

  // Official Hardware Command Topic (subscribed by firmware)
  // Example: devices/nt8k-BC88-TP8/set
  getCommandTopic: (deviceId: string) => `devices/${deviceId}/set`,

  // Backwards compatibility topics
  DEVICE_STATE: `${ENV.MQTT_TOPIC_PREFIX}/+/state`,
  DEVICE_TELEMETRY: `${ENV.MQTT_TOPIC_PREFIX}/+/telemetry`,
  DEVICE_STATUS: `${ENV.MQTT_TOPIC_PREFIX}/+/status`,
  getLegacyCommandTopic: (deviceId: string) => `${ENV.MQTT_TOPIC_PREFIX}/${deviceId}/set`,
};
