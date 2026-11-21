import { API_BASE_URL } from './api';

export const OTA_TOKEN = 'neuro_ota_session';

export class OtaRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OtaRequestError';
    this.status = status;
  }
}

export const otaApi = {
  async request<T>(path: string, body?: unknown, options: { method?: 'GET' | 'POST' | 'DELETE'; signal?: AbortSignal } = {}): Promise<T> {
    const token = sessionStorage.getItem(OTA_TOKEN) || '';
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && path !== '/ota/session' && sessionStorage.getItem(OTA_TOKEN) === token) {
        sessionStorage.removeItem(OTA_TOKEN);
        window.dispatchEvent(new Event('ota-session-expired'));
      }
      throw new OtaRequestError(typeof result?.error === 'string' ? result.error : 'The administration request failed. Try again.', response.status);
    }
    return result as T;
  },
};
