import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3056', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://neurolinx_admin:NeuroSeriesSecure2026!@localhost:5439/neurolinx_smart_workspace',
  JWT_SECRET: process.env.JWT_SECRET || 'neuro_series_fallback_jwt_secret_dev_only',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',

  // Google OAuth Client IDs (Web, Android APK, iOS)
  GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID || '',
  GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
  GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID || '',

  // EMQX MQTT Broker Configuration
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1887',
  MQTT_PUBLIC_HOST: process.env.MQTT_PUBLIC_HOST || 'api.neurolinx.in',
  MQTT_PUBLIC_PORT: parseInt(process.env.MQTT_PUBLIC_PORT || '8883', 10),
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'neuro-series-server-backend',
  MQTT_USERNAME: process.env.MQTT_USERNAME || 'neuro_device_user',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || 'NeuroSeriesEmqx2026!',
  MQTT_TOPIC_PREFIX: process.env.MQTT_TOPIC_PREFIX || 'neurolinx/devices',
};
