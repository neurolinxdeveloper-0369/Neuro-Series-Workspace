import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3056', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://neurolinx_admin:NeuroSeriesSecure2026!@localhost:5439/neurolinx_smart_workspace',
  JWT_SECRET: process.env.JWT_SECRET || 'neuro_series_jwt_secret_change_in_production_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883',
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'neuro-series-server-backend',
  MQTT_USERNAME: process.env.MQTT_USERNAME || '',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || '',
  MQTT_TOPIC_PREFIX: process.env.MQTT_TOPIC_PREFIX || 'neurolinx/devices',
};
