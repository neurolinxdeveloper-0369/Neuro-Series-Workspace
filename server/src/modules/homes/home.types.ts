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

export interface CreateHomeDTO {
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

export interface UpdateHomeDTO {
  name?: string;
  property_type?: PropertyType;
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
  created_at: string;
  updated_at?: string;
}

export interface HomeInvitation {
  id: string;
  home_id: string;
  invited_by: string;
  email: string;
  access_level: string;
  status: string;
  created_at: string;
}
