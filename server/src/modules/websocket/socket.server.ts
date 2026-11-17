import { memberDeviceScope } from '../homes/home.access.js';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifySessionToken } from '../auth/auth.middleware.js';
import { db } from '../../config/database.js';

class SocketManager {
  private sessions = new Map<WebSocket, ReturnType<typeof verifySessionToken>>();

  public init(server: Server) {
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
    wss.on('connection', ws => {
      const authTimeout = setTimeout(() => ws.close(1008, 'Authentication required'), 5000);
      ws.once('message', message => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type !== 'AUTH' || typeof data.token !== 'string') throw new Error('Invalid authentication');
          this.sessions.set(ws, verifySessionToken(data.token));
          ws.send(JSON.stringify({ type: 'CONNECTION_ACK' }));
        } catch {
          ws.close(1008, 'Invalid authentication');
        } finally {
          clearTimeout(authTimeout);
        }
      });
      ws.on('error', () => ws.terminate());
      ws.on('close', () => {
        clearTimeout(authTimeout);
        this.sessions.delete(ws);
      });
    });
  }

  public broadcastDeviceUpdate(deviceId: string, state: Record<string, unknown>) {
    if (!this.sessions.size) return;

    // Capture recipients before querying so a newly authenticated connection receives only fresh events.
    const recipients = [...this.sessions];
    void db.query(
      `SELECT h.owner_id AS user_id FROM devices d JOIN homes h ON h.id = d.home_id WHERE d.device_id = $1
       UNION SELECT m.user_id FROM devices d JOIN home_members m ON m.home_id = d.home_id WHERE d.device_id = $1 AND ${memberDeviceScope}`,
      [deviceId]
    ).then(result => {
      const allowed = new Set(result.rows.map(row => row.user_id));
      if (!allowed.size) return;
      const payload = JSON.stringify({ type: 'DEVICE_STATE_CHANGED', deviceId, state, timestamp: new Date().toISOString() });
      for (const [client, session] of recipients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        if (session.expiresAt <= Date.now()) {
          client.close(1008, 'Session expired');
          continue;
        }
        if (allowed.has(session.id)) client.send(payload);
      }
    }).catch(() => console.error('Could not resolve telemetry recipients'));
  }
}

export const socketManager = new SocketManager();
