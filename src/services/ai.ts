import { api } from './api';
import { authStorage } from './auth';

export interface AiChatAction {
  type: 'control' | 'scene' | 'nav' | 'whatsapp_support';
  deviceId?: string;
  channel?: number;
  targetState?: 'on' | 'off';
  routineId?: string;
  tabId?: string;
  phone?: string;
  prefillText?: string;
  label: string;
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  action?: AiChatAction;
  realtimeContext?: {
    homeName: string;
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
  };
  provider: 'ollama' | 'grounded-engine';
  model: string;
}

export interface AiStatusResponse {
  success: boolean;
  ollama: {
    available: boolean;
    models: string[];
    host: string;
  };
}

export const aiApi = {
  /**
   * Send a chat message to the Ollama / Grounded AI backend
   */
  chat: async (
    message: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    homeId?: string
  ): Promise<AiChatResponse> => {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Please sign in to chat with Neuro AI Assistant.');
    }

    return api.post<AiChatResponse>('/ai/chat', {
      message,
      history,
      homeId,
    });
  },

  /**
   * Get live AI service status (checks Ollama at 127.0.0.1:11434)
   */
  getStatus: async (): Promise<AiStatusResponse> => {
    try {
      return await api.get<AiStatusResponse>('/ai/status');
    } catch {
      return {
        success: false,
        ollama: {
          available: false,
          models: [],
          host: 'http://127.0.0.1:11434',
        },
      };
    }
  },

  /**
   * Get user's live real-time device telemetry
   */
  getTelemetry: async (): Promise<any> => {
    const token = authStorage.getToken();
    if (!token) return null;
    try {
      const res = await api.get<{ success: boolean; context: any }>('/ai/telemetry');
      return res.context;
    } catch {
      return null;
    }
  },
};
