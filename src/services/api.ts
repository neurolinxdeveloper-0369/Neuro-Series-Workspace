/**
 * Strict Production API Client
 * - Enforces HTTPS and blocks accidental localhost calls in production
 * - Enforces strict security headers and bearer token authentication
 * - Handles error normalization and request timeouts
 */

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'https://api.neurolinx.in';
};

export const API_BASE_URL = getApiBaseUrl();

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiSecurityError';
  }
}

/**
 * Validates target URL against strict production security standards.
 * Rejects insecure HTTP and localhost calls when in production.
 */
export const validateEndpointSecurity = (url: string): string => {
  const isProduction = import.meta.env.PROD;
  
  // Resolve relative endpoints to the API base URL
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  if (isProduction) {
    if (fullUrl.includes('localhost') || fullUrl.includes('127.0.0.1')) {
      throw new ApiSecurityError(`[Security Blocked] Insecure localhost API calls are forbidden in production: ${fullUrl}`);
    }
    if (fullUrl.startsWith('http://') && !fullUrl.startsWith('http://localhost')) {
      // Force HTTPS upgrade in production
      return fullUrl.replace('http://', 'https://');
    }
  }

  return fullUrl;
};

/**
 * Executes a secure API request with strict security headers
 */
export async function secureApiCall<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const targetUrl = validateEndpointSecurity(endpoint);
  const timeoutMs = options.timeoutMs ?? 15000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const token = typeof window !== 'undefined' ? localStorage.getItem('neuro_auth_token') : null;

  const secureHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const response = await fetch(targetUrl, {
      ...options,
      headers: secureHeaders,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API Error [${response.status}]: ${errorText || response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T>(url: string, options?: ApiRequestOptions) => secureApiCall<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, data?: unknown, options?: ApiRequestOptions) => 
    secureApiCall<T>(url, { ...options, method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(url: string, data?: unknown, options?: ApiRequestOptions) => 
    secureApiCall<T>(url, { ...options, method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  del: <T>(url: string, options?: ApiRequestOptions) => secureApiCall<T>(url, { ...options, method: 'DELETE' }),
};
