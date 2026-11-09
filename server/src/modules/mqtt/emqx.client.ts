import mqtt, { type MqttClient } from 'mqtt';
import { ENV } from '../../config/env.js';
import { MQTT_TOPICS } from './emqx.topics.js';
import { socketManager } from '../websocket/socket.server.js';

class EmqxService {
  private client: MqttClient | null = null;
  private telemetryHandlers: Array<(deviceId: string, payload: any) => Promise<void> | void> = [];
  private heartbeatHandlers: Array<(deviceId: string, payload: any) => Promise<void> | void> = [];

  public onTelemetry(handler: (deviceId: string, payload: any) => Promise<void> | void) {
    this.telemetryHandlers.push(handler);
  }

  public onHeartbeat(handler: (deviceId: string, payload: any) => Promise<void> | void) {
    this.heartbeatHandlers.push(handler);
  }

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

      // Subscribe to hardware telemetry, heartbeats & legacy state topics
      const topicsToSubscribe = [
        MQTT_TOPICS.HARDWARE_TELEMETRY,
        MQTT_TOPICS.HARDWARE_HEARTBEAT,
        'devices/+/telemetry',
        'devices/+/state',
        'devices/+/stat',
        MQTT_TOPICS.DEVICE_STATE,
        MQTT_TOPICS.DEVICE_TELEMETRY,
        MQTT_TOPICS.DEVICE_STATUS
      ];

      this.client?.subscribe(topicsToSubscribe, (err) => {
        if (err) {
          console.error('❌ Failed to subscribe to MQTT topics:', err);
        } else {
          console.log(`📡 Subscribed to MQTT topics:\n  - ${topicsToSubscribe.join('\n  - ')}`);
        }
      });
    });

    this.client.on('message', async (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log(`📥 [EMQX INCOMING] Topic: ${topic} =>`, payload);

        // Case 1: Hardware Telemetry (nt/v1/{deviceId}/stat/telemetry or devices/{deviceId}/telemetry / state)
        const isHardwareTelemetry = (topic.startsWith('nt/') && topic.endsWith('/stat/telemetry')) ||
          (topic.startsWith('devices/') && (topic.endsWith('/telemetry') || topic.endsWith('/state') || topic.endsWith('/stat'))) ||
          (topic.startsWith('neurolinx/devices/') && (topic.endsWith('/telemetry') || topic.endsWith('/state')));

        if (isHardwareTelemetry) {
          const parts = topic.split('/');
          let deviceId = payload.deviceId;
          if (!deviceId) {
            if (parts[0] === 'devices') deviceId = parts[1];
            else if (parts[0] === 'nt') deviceId = parts[2];
            else if (parts[0] === 'neurolinx') deviceId = parts[2];
          }

          if (deviceId) {
            for (const handler of this.telemetryHandlers) {
              try {
                await handler(deviceId, payload);
              } catch (handlerErr) {
                console.error(`Error in telemetry handler for ${deviceId}:`, handlerErr);
              }
            }
          }
          return;
        }

        // Case 2: Hardware Heartbeat (e.g. devices/{deviceId}/heartbeat)
        if (topic.startsWith('devices/') && topic.endsWith('/heartbeat')) {
          const parts = topic.split('/');
          const deviceId = payload.deviceId || parts[1];
          if (deviceId) {
            for (const handler of this.heartbeatHandlers) {
              try {
                await handler(deviceId, payload);
              } catch (handlerErr) {
                console.error(`Error in heartbeat handler for ${deviceId}:`, handlerErr);
              }
            }
          }
          return;
        }

        // Case 3: Legacy State topic (neurolinx/devices/{deviceId}/state)
        const parts = topic.split('/');
        const legacyDeviceId = parts[2];
        if (legacyDeviceId && topic.endsWith('/state')) {
          socketManager.broadcastDeviceUpdate(legacyDeviceId, payload);
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

  // Publish switch control envelope to hardware on devices/{deviceId}/set
  public sendSwitchCommand(deviceId: string, channel: number | string, state: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        return reject(new Error('MQTT Client not connected to EMQX broker'));
      }

      const topic = MQTT_TOPICS.getCommandTopic(deviceId);
      const envelope = {
        v: 1,
        ts: new Date().toISOString(),
        msgId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        payload: {
          [String(channel)]: state
        }
      };

      const payloadStr = JSON.stringify(envelope);
      
      // Dual-publish to both standard and legacy topics
      const legacyTopic = MQTT_TOPICS.getLegacyCommandTopic(deviceId);
      this.client.publish(legacyTopic, payloadStr, { qos: 1 }, () => {});

      this.client.publish(topic, payloadStr, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ Failed to publish switch command to ${topic}:`, err);
          return reject(err);
        }
        console.log(`📤 [EMQX HARDWARE COMMAND] Sent to ${topic}:`, payloadStr);
        resolve();
      });
    });
  }

  // Generic publish command to EMQX
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
