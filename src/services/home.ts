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
  image_path?: string | null;
  id: string;
  home_id: string;
  name: string;
  created_at?: string;
}

export interface MemberAccess {
  role: 'view' | 'control';
  roomIds: string[] | null;
  deviceIds: string[] | null;
}

export type HomeMember = { id: string; full_name: string | null; role: MemberAccess['role']; room_ids: string[] | null; device_ids: string[] | null };

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
    if (!res.success || !Array.isArray(res.homes)) throw new Error('Could not load locations.');
    return res.homes;
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

  // Get saved home Wi-Fi credentials for hardware provisioning
  getHomeWifiCredentials: async (homeId: string): Promise<{ ssid: string; password: string }> => {
    try {
      const res = await api.get<{ success: boolean; wifi: { ssid: string; password: string } }>(`/homes/${homeId}/wifi`);
      return res.success && res.wifi ? res.wifi : { ssid: '', password: '' };
    } catch {
      return { ssid: '', password: '' };
    }
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

  // Create a shareable invitation, optionally restricted by recipient email
  createInvitation: async (homeId: string, email?: string, access?: MemberAccess) =>
    api.post<{ success: boolean; code: string; id: string; expiresAt: string }>(`/homes/${homeId}/invitations`, { email, access }),

  getInvitations: async (homeId: string) =>
    (await api.get<{ invitations: HomeInvitation[] }>(`/homes/${homeId}/invitations`)).invitations,

  revokeInvitation: async (homeId: string, inviteId: string) =>
    api.del(`/homes/${homeId}/invitations/${inviteId}`),

  getMembers: async (homeId: string) =>
    (await api.get<{ members: HomeMember[] }>(`/homes/${homeId}/members`)).members,

  updateMember: async (homeId: string, userId: string, access: MemberAccess) =>
    api.patch(`/homes/${homeId}/members/${userId}`, access),

  removeMember: async (homeId: string, userId: string) =>
    api.del(`/homes/${homeId}/members/${userId}`),

  joinLocation: async (code: string) =>
    (await api.post<{ success: boolean; homeId: string }>('/homes/join', { code })).homeId,

};
