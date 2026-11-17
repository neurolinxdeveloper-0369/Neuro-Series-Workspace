import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';

process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
const { socketManager } = await import('../dist/modules/websocket/socket.server.js');

test('WebSocket upgrades on both deployment paths', async () => {
  const server = createServer();
  socketManager.init(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const path of ['/ws', '/neuro-series/ws']) {
      const socket = new WebSocket('ws://127.0.0.1:' + server.address().port + path);
      const events = await Promise.race([
        once(socket, 'open').then(() => 'open'),
        once(socket, 'error').then(() => 'error'),
      ]);
      assert.equal(events, 'open');
      const closed = once(socket, 'close');
      socket.close();
      await closed;
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
