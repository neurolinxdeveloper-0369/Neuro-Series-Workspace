import http from 'http';
import { app } from './app.js';
import { ENV } from './config/env.js';
import { socketManager } from './modules/websocket/socket.server.js';
import { emqxService } from './modules/mqtt/emqx.client.js';
import { db } from './config/database.js';

const server = http.createServer(app);

// 1. Initialize WebSocket Gateway on same HTTP server
socketManager.init(server);

// 2. Start HTTP & WebSocket Server
server.listen(ENV.PORT, () => {
  console.log(`🚀 Neuro Series Server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
  console.log(`🔗 REST API: http://localhost:${ENV.PORT}/api`);
  console.log(`📡 WebSocket: ws://localhost:${ENV.PORT}/ws`);

  // 3. Connect to EMQX MQTT Broker
  emqxService.connect();
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('\n🛑 Gracefully shutting down Neuro Series Server...');
  server.close(async () => {
    await db.end();
    console.log('✅ Server and database pool closed cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
