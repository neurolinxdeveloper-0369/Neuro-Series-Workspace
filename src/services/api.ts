import { Capacitor } from '@capacitor/core';

/**
 * Strict Production API Client
 * - Enforces HTTPS and blocks accidental localhost calls in production
 * - Automatically routes to https://neurolinx.in/neuro-series/api on native mobile (APK/IPA)
 * - Enforces strict security headers and bearer token authentication
 * - Handles error normalization and request timeouts
 */

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && !envUrl.startsWith('/')) {
    return envUrl.replace(/\/+$/, '');
  }

  // When running inside Capacitor native mobile container (Android/iOS)
  if (typeof window !== 'undefined') {
    const isNative = Capacitor.isNativePlatform() || 
      window.location.protocol === 'capacitor:' || 
      (window.location.hostname === 'localhost' && !import.meta.env.DEV);
    if (isNative) {
      return 'https://neurolinx.in/neuro-series/api';
    }
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3056/api';
  }

  const basePath = (import.meta.env.BASE_URL || '/neuro-series/').replace(/\/+$/, '');
  return `${basePath}/api`;
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
 * Rejects insecure HTTP and localhost calls when in production (except AP 192.168.4.1).
 */
export const validateEndpointSecurity = (url: string): string => {
  const isProduction = import.meta.env.PROD;
  
  // Resolve relative endpoints to the API base URL
  const fullUrl = (url.startsWith('http://') || url.startsWith('https://'))
    ? url 
    : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  if (isProduction) {
    // Only block localhost if not on native platform or explicitly calling local server
    if (!Capacitor.isNativePlatform() && (fullUrl.includes('localhost:') || fullUrl.includes('127.0.0.1:'))) {
      throw new ApiSecurityError(`[Security Blocked] Insecure localhost API calls are forbidden in production: ${fullUrl}`);
    }
    if (fullUrl.startsWith('http://') && !fullUrl.includes('192.168.4.1')) {
      // Force HTTPS upgrade in production for external links
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
  patch: <T>(url: string, data?: unknown, options?: ApiRequestOptions) => 
    secureApiCall<T>(url, { ...options, method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  del: <T>(url: string, options?: ApiRequestOptions) => secureApiCall<T>(url, { ...options, method: 'DELETE' }),
};
