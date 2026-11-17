import { authStorage } from './auth';
import { Capacitor } from '@capacitor/core';

type DeviceUpdateHandler = (deviceId: string, state: any) => void;

class RealtimeSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<DeviceUpdateHandler> = new Set();
  private reconnectTimer: any = null;

  private getSocketUrl(): string {
    const isNative = Capacitor.isNativePlatform() || 
      (typeof window !== 'undefined' && window.location.protocol === 'capacitor:');

    if (isNative) {
      return 'wss://neurolinx.in/neuro-series/ws';
    }

    if (typeof window !== 'undefined') {
      const loc = window.location;
      if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
        return 'ws://localhost:3056/ws';
      }
      const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${loc.host}/neuro-series/ws`;
    }

    return 'wss://neurolinx.in/neuro-series/ws';
  }

  public connect() {
    const token = authStorage.getToken();
    if (!token || !this.listeners.size) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = this.getSocketUrl();
      console.log(`🔌 Connecting to Real-Time WebSocket at ${url}...`);
      this.ws = new WebSocket(url);

      const socket = this.ws;
      socket.onopen = () => socket.send(JSON.stringify({ type: 'AUTH', token }));

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'DEVICE_STATE_CHANGED' && data.deviceId) {
            for (const listener of this.listeners) {
              try {
                listener(data.deviceId, data.state);
              } catch (err) {
                console.error('Error in socket listener:', err);
              }
            }
          }
        } catch {
          // ignore non-json
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Real-Time WebSocket notice:', err);
      };

      socket.onclose = event => {
        if (this.ws !== socket) return;
        this.ws = null;
        if (this.listeners.size && event.code !== 1008) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };
    } catch (e) {
      console.warn('Could not establish WebSocket connection:', e);
    }
  }

  public subscribe(handler: DeviceUpdateHandler): () => void {
    this.listeners.add(handler);
    this.connect();
    return () => {
      this.listeners.delete(handler);
      if (!this.listeners.size) {
        clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
      }
    };
  }
}

export const realtimeSocket = new RealtimeSocketClient();
