import mqtt, { type MqttClient } from 'mqtt';
import { ENV } from '../../config/env.js';
import { MQTT_TOPICS } from './emqx.topics.js';
import { socketManager } from '../websocket/socket.server.js';

class EmqxService {
  private client: MqttClient | null = null;

  public connect() {
    console.log(`🔌 Connecting to EMQX Broker at ${ENV.MQTT_BROKER_URL}...`);

    this.client = mqtt.connect(ENV.MQTT_BROKER_URL, {
      clientId: `${ENV.MQTT_CLIENT_ID}_${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 4000,
      username: ENV.MQTT_USERNAME || undefined,
      password: ENV.MQTT_PASSWORD || undefined,
      reconnectPeriod: 2000,
    });

    this.client.on('connect', () => {
      console.log('✅ Connected to EMQX MQTT Broker successfully!');

      // Subscribe to device states & telemetry
      this.client?.subscribe([MQTT_TOPICS.DEVICE_STATE, MQTT_TOPICS.DEVICE_TELEMETRY, MQTT_TOPICS.DEVICE_STATUS], (err) => {
        if (err) {
          console.error('❌ Failed to subscribe to MQTT topics:', err);
        } else {
          console.log(`📡 Subscribed to MQTT topics: ${MQTT_TOPICS.DEVICE_STATE}`);
        }
      });
    });

    this.client.on('message', (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log(`📥 [EMQX INCOMING] Topic: ${topic} =>`, payload);

        // Extract deviceId from topic: neurolinx/devices/{deviceId}/state
        const parts = topic.split('/');
        const deviceId = parts[2];

        if (deviceId && topic.endsWith('/state')) {
          // Broadcast to connected web clients in real time
          socketManager.broadcastDeviceUpdate(deviceId, payload);
        }
      } catch {
        console.warn(`⚠️ Could not parse message on topic ${topic}:`, message.toString());
      }
    });

    this.client.on('error', (err) => {
      console.error('❌ EMQX MQTT Error:', err.message);
    });

    this.client.on('offline', () => {
      console.warn('⚠️ EMQX MQTT Client is offline. Retrying...');
    });
  }

  // Publish command to EMQX for a physical device (e.g. switch on/off, dimming)
  public publishCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        return reject(new Error('MQTT Client not connected to EMQX broker'));
      }

      const topic = MQTT_TOPICS.getCommandTopic(deviceId);
      const payload = JSON.stringify(command);

      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ Failed to publish command to ${topic}:`, err);
          return reject(err);
        }
        console.log(`📤 [EMQX PUBLISH] Sent command to ${topic}:`, payload);
        resolve();
      });
    });
  }
}

export const emqxService = new EmqxService();
