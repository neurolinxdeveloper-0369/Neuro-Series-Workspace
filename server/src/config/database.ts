import pg from 'pg';
import { ENV } from './env.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: ENV.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('connect', () => {
  console.log('✅ PostgreSQL connected successfully (neurolinx_smart_workspace)');
});

db.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL client error:', err);
});
