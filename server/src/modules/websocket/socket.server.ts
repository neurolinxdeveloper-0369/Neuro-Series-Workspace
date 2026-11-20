import { memberDeviceScope } from '../homes/home.access.js';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifySessionToken } from '../auth/auth.middleware.js';
import { db } from '../../config/database.js';
import { verifyOtaSession } from '../ota/ota.auth.js';

class SocketManager {
  private sessions = new Map<WebSocket, ReturnType<typeof verifySessionToken>>();
  private otaSessions = new Map<WebSocket, ReturnType<typeof verifyOtaSession>>();

  public init(server: Server) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
    server.on('upgrade', (request, socket, head) => {
      const path = request.url?.split('?')[0];
      if (path !== '/ws' && path !== '/neuro-series/ws') {
        socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        return;
      }
      wss.handleUpgrade(request, socket, head, client => wss.emit('connection', client, request));
    });
    wss.on('connection', ws => {
      const authTimeout = setTimeout(() => ws.close(1008, 'Authentication required'), 5000);
      ws.once('message', message => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'OTA_AUTH' && typeof data.token === 'string') {
            this.otaSessions.set(ws, verifyOtaSession(data.token));
            ws.send(JSON.stringify({ type: 'CONNECTION_ACK' }));
            return;
          }
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
        this.otaSessions.delete(ws);
      });
    });
  }

  public broadcastOtaUpdate(job: Record<string, unknown>) {
    const { id, device_id, status, progress, detail, updated_at } = job;
    const payload = JSON.stringify({ type: 'OTA_UPDATE', job: { id, device_id, status, progress, detail, updated_at } });
    for (const [client, session] of this.otaSessions) {
      if (session.expiresAt <= Date.now()) { client.close(1008, 'OTA session expired'); continue; }
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
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
