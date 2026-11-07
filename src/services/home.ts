import { api } from './api';

export type PropertyType = 'Flat' | 'Apartment' | 'Villa' | 'House' | 'Office' | 'Building';

export interface Home {
  id: string;
  owner_id: string;
  name: string;
  property_type: PropertyType;
  floor_count: number;
  address_line: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  default_wifi_ssid: string | null;
  has_wifi_configured?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHomeInput {
  name: string;
  property_type: PropertyType;
  floor_count?: number;
  address_line?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  default_wifi_ssid?: string;
  wifi_password?: string;
}

export interface Room {
  id: string;
  home_id: string;
  name: string;
  created_at?: string;
}

export interface HomeInvitation {
  id: string;
  home_id: string;
  invited_by: string;
  email: string;
  access_level: string;
  status: string;
  created_at?: string;
}

const ACTIVE_HOME_KEY = 'neuro_active_home_id';

export const homeStorage = {
  getActiveHomeId: (): string | null => {
    return typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_HOME_KEY) : null;
  },
  setActiveHomeId: (homeId: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_HOME_KEY, homeId);
    }
  },
  clearActiveHomeId: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_HOME_KEY);
    }
  },
};

export const homeApi = {
  // Fetch all homes for current user
  getHomes: async (): Promise<Home[]> => {
    const res = await api.get<{ success: boolean; homes: Home[] }>('/homes');
    return res.success && Array.isArray(res.homes) ? res.homes : [];
  },

  // Create a new home property
  createHome: async (input: CreateHomeInput): Promise<Home> => {
    const res = await api.post<{ success: boolean; home: Home }>('/homes', input);
    if (!res.success || !res.home) {
      throw new Error('Failed to create home');
    }
    homeStorage.setActiveHomeId(res.home.id);
    return res.home;
  },

  // Get home by ID
  getHomeById: async (homeId: string): Promise<Home | null> => {
    const res = await api.get<{ success: boolean; home: Home }>(`/homes/${homeId}`);
    return res.success ? res.home : null;
  },

  // Delete home
  deleteHome: async (homeId: string): Promise<boolean> => {
    const res = await api.del<{ success: boolean }>(`/homes/${homeId}`);
    if (homeStorage.getActiveHomeId() === homeId) {
      homeStorage.clearActiveHomeId();
    }
    return res.success;
  },

  // Get signed QR share payload
  getQrPayload: async (homeId: string): Promise<{ shareToken: string; qrData: string }> => {
    const res = await api.get<{ success: boolean; shareToken: string; qrData: string }>(`/homes/${homeId}/qr`);
    return {
      shareToken: res.shareToken,
      qrData: res.qrData,
    };
  },

  // Get all rooms for a home
  getRooms: async (homeId: string): Promise<Room[]> => {
    const res = await api.get<{ success: boolean; rooms: Room[] }>(`/homes/${homeId}/rooms`);
    return res.success && Array.isArray(res.rooms) ? res.rooms : [];
  },

  // Create a new room
  createRoom: async (homeId: string, name: string): Promise<Room> => {
    const res = await api.post<{ success: boolean; room: Room }>(`/homes/${homeId}/rooms`, { name });
    if (!res.success || !res.room) {
      throw new Error('Failed to create room');
    }
    return res.room;
  },

  // Delete a room
  deleteRoom: async (homeId: string, roomId: string): Promise<boolean> => {
    const res = await api.del<{ success: boolean }>(`/homes/${homeId}/rooms/${roomId}`);
    return res.success;
  },

  // Send an invitation email
  sendInvitation: async (homeId: string, email: string, accessLevel: string = 'Full access'): Promise<HomeInvitation> => {
    const res = await api.post<{ success: boolean; invitation: HomeInvitation }>(`/homes/${homeId}/invitations`, {
      email,
      accessLevel,
    });
    if (!res.success || !res.invitation) {
      throw new Error('Failed to send invitation');
    }
    return res.invitation;
  },

  // Get list of invitations
  getInvitations: async (homeId: string): Promise<HomeInvitation[]> => {
    const res = await api.get<{ success: boolean; invitations: HomeInvitation[] }>(`/homes/${homeId}/invitations`);
    return res.success && Array.isArray(res.invitations) ? res.invitations : [];
  },
};
