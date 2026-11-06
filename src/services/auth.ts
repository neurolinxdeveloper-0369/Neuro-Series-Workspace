import { api } from './api';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  success: boolean;
  user: UserProfile;
  token: string;
  error?: string;
}

export const GOOGLE_WEB_CLIENT_ID = 
  import.meta.env.VITE_GOOGLE_CLIENT_ID || 
  '600716895881-bjunr7bllqd3ccgmnmfmub46cfu0q8ug.apps.googleusercontent.com';

const TOKEN_KEY = 'neuro_auth_token';
const USER_KEY = 'neuro_auth_user';

export const authStorage = {
  getToken: (): string | null => {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  },
  getUser: (): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },
  setSession: (token: string, user: UserProfile): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
  clearSession: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },
  isAuthenticated: (): boolean => {
    return !!authStorage.getToken();
  },
};

export const authApi = {
  // Submit Google token (idToken or accessToken) to backend for verification and Postgres registration
  loginWithGoogle: async (payload: { idToken?: string; accessToken?: string } | string): Promise<AuthResponse> => {
    const body = typeof payload === 'string' ? { idToken: payload } : payload;
    const response = await api.post<AuthResponse>('/auth/google', body);
    if (response.success && response.token && response.user) {
      authStorage.setSession(response.token, response.user);
    }
    return response;
  },

  // Phone number login / registration
  loginWithPhone: async (phoneNumber: string, fullName?: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/phone', { phoneNumber, fullName });
    if (response.success && response.token && response.user) {
      authStorage.setSession(response.token, response.user);
    }
    return response;
  },

  // Get current user profile with JWT token
  getProfile: async (): Promise<UserProfile | null> => {
    try {
      const response = await api.get<{ success: boolean; user: UserProfile }>('/auth/me');
      if (response.success && response.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        }
        return response.user;
      }
      return null;
    } catch {
      return null;
    }
  },

  logout: () => {
    authStorage.clearSession();
  },
};
