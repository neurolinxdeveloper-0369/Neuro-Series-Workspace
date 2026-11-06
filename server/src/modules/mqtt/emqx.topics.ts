import { ENV } from '../../config/env.js';

export const MQTT_TOPICS = {
  // Telemetry published by devices -> Subscribed by Backend
  // Example: neurolinx/devices/switch_living_room/state
  DEVICE_STATE: `${ENV.MQTT_TOPIC_PREFIX}/+/state`,

  // Telemetry sensor readings (temperature, power, etc.)
  // Example: neurolinx/devices/sensor_bedroom/telemetry
  DEVICE_TELEMETRY: `${ENV.MQTT_TOPIC_PREFIX}/+/telemetry`,

  // Device online/offline LWT (Last Will and Testament)
  // Example: neurolinx/devices/switch_living_room/status
  DEVICE_STATUS: `${ENV.MQTT_TOPIC_PREFIX}/+/status`,

  // Helper function to generate command topic for a specific device
  // Example: neurolinx/devices/{deviceId}/set
  getCommandTopic: (deviceId: string) => `${ENV.MQTT_TOPIC_PREFIX}/${deviceId}/set`,
};
