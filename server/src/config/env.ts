import dotenv from 'dotenv';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error('Set JWT_SECRET to a randomly generated secret of at least 32 bytes');
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3056', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5439/neurolinx_smart_workspace',
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',

  // Google OAuth Client IDs (Web, Android APK, iOS)
  GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID || '',
  GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
  GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID || '',

  // EMQX MQTT Broker Configuration
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1887',
  MQTT_PUBLIC_HOST: process.env.MQTT_PUBLIC_HOST || 'api.neurolinx.in',
  MQTT_PUBLIC_PORT: parseInt(process.env.MQTT_PUBLIC_PORT || '1887', 10),
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'neuro-series-server-backend',
  MQTT_USERNAME: process.env.MQTT_USERNAME || '',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || '',
  MQTT_DEVICE_USERNAME: process.env.MQTT_DEVICE_USERNAME || '',
  MQTT_DEVICE_PASSWORD: process.env.MQTT_DEVICE_PASSWORD || '',
  MQTT_USE_LEGACY_COMMAND_TOPICS: process.env.MQTT_USE_LEGACY_COMMAND_TOPICS === 'true',
  MQTT_TOPIC_PREFIX: process.env.MQTT_TOPIC_PREFIX || 'neurolinx/devices',

  // Email / SMTP Configuration
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'Neuro Series <neurolinxdeveloper@gmail.com>',

  // OpenWA WhatsApp Gateway Configuration
  OPENWA_BASE_URL: process.env.OPENWA_BASE_URL || 'http://50.6.45.177:2785/api',
  OPENWA_API_KEY: process.env.OPENWA_API_KEY || '',
  OPENWA_SESSION_NAME: process.env.OPENWA_SESSION_NAME || 'neuro-touch',
  OPENWA_SESSION_ID: process.env.OPENWA_SESSION_ID || '40f62065-9a8e-4f77-8120-7f3bd73f50ea',
};
