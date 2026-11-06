import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

class SocketManager {
  private wss: WebSocketServer | null = null;

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('📡 WebSocket client connected (Neuro Series Frontend)');

      ws.send(JSON.stringify({
        type: 'CONNECTION_ACK',
        message: 'Connected to Neuro Series Real-Time Stream',
        timestamp: new Date().toISOString(),
      }));

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          console.log('📩 Received WebSocket message from client:', parsed);
        } catch {
          // Ignore malformed payloads
        }
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
      });
    });

    console.log('⚡ WebSocket server initialized on path: /ws');
  }

  // Broadcast device updates to all connected frontend clients
  public broadcastDeviceUpdate(deviceId: string, state: Record<string, unknown>) {
    if (!this.wss) return;

    const payload = JSON.stringify({
      type: 'DEVICE_STATE_CHANGED',
      deviceId,
      state,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

export const socketManager = new SocketManager();
