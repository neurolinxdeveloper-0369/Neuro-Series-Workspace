import { db } from '../../config/database.js';
import { encryptSecret } from '../../utils/crypto.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env.js';
import type { Home, CreateHomeDTO, UpdateHomeDTO, Room, HomeInvitation } from './home.types.js';

export const homeService = {
  /**
   * Ensures the homes, rooms, and invitations tables exist in PostgreSQL.
   * Runs automatically at application boot.
   */
  ensureTableExists: async (): Promise<void> => {
    const query = `
      CREATE TABLE IF NOT EXISTS homes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          property_type VARCHAR(30) NOT NULL,
          floor_count INT DEFAULT 1,
          address_line TEXT,
          city VARCHAR(100),
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
          default_wifi_ssid VARCHAR(64),
          wifi_password_encrypted TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_homes_owner_id ON homes(owner_id);

      CREATE TABLE IF NOT EXISTS rooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_rooms_home_id ON rooms(home_id);

      CREATE TABLE IF NOT EXISTS home_invitations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
          invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          access_level VARCHAR(50) DEFAULT 'Full access',
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_invitations_home_id ON home_invitations(home_id);
    `;
    try {
      await db.query(query);
      console.log('✅ Homes, Rooms & Invitations tables initialized in PostgreSQL');
    } catch (error) {
      console.error('❌ Failed to verify database tables in PostgreSQL:', error);
    }
  },

  /**
   * List all homes belonging to a user
   */
  getHomesByOwner: async (ownerId: string): Promise<Home[]> => {
    const query = `
      SELECT 
        id, 
        owner_id, 
        name, 
        property_type, 
        floor_count, 
        address_line, 
        city, 
        latitude, 
        longitude, 
        timezone, 
        default_wifi_ssid,
        CASE WHEN wifi_password_encrypted IS NOT NULL AND wifi_password_encrypted <> '' THEN true ELSE false END as has_wifi_configured,
        created_at, 
        updated_at
      FROM homes
      WHERE owner_id = $1
      ORDER BY created_at ASC
    `;
    const result = await db.query(query, [ownerId]);
    return result.rows.map((row) => ({
      ...row,
      floor_count: Number(row.floor_count) || 1,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
    }));
  },

  /**
   * Get single home details by ID
   */
  getHomeById: async (homeId: string, ownerId: string): Promise<Home | null> => {
    const query = `
      SELECT 
        id, 
        owner_id, 
        name, 
        property_type, 
        floor_count, 
        address_line, 
        city, 
        latitude, 
        longitude, 
        timezone, 
        default_wifi_ssid,
        CASE WHEN wifi_password_encrypted IS NOT NULL AND wifi_password_encrypted <> '' THEN true ELSE false END as has_wifi_configured,
        created_at, 
        updated_at
      FROM homes
      WHERE id = $1 AND owner_id = $2
    `;
    const result = await db.query(query, [homeId, ownerId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      floor_count: Number(row.floor_count) || 1,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
    };
  },

  /**
   * Create a new home property with optional encrypted Wi-Fi password
   */
  createHome: async (ownerId: string, data: CreateHomeDTO): Promise<Home> => {
    const encryptedWifiPassword = data.wifi_password ? encryptSecret(data.wifi_password) : null;
    const floorCount = Math.max(1, Number(data.floor_count) || 1);

    const query = `
      INSERT INTO homes (
        owner_id, 
        name, 
        property_type, 
        floor_count, 
        address_line, 
        city, 
        latitude, 
        longitude, 
        timezone, 
        default_wifi_ssid, 
        wifi_password_encrypted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, 
        owner_id, 
        name, 
        property_type, 
        floor_count, 
        address_line, 
        city, 
        latitude, 
        longitude, 
        timezone, 
        default_wifi_ssid,
        CASE WHEN wifi_password_encrypted IS NOT NULL AND wifi_password_encrypted <> '' THEN true ELSE false END as has_wifi_configured,
        created_at, 
        updated_at
    `;

    const values = [
      ownerId,
      data.name.trim(),
      data.property_type,
      floorCount,
      data.address_line ? data.address_line.trim() : null,
      data.city ? data.city.trim() : null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.timezone || 'Asia/Kolkata',
      data.default_wifi_ssid ? data.default_wifi_ssid.trim() : null,
      encryptedWifiPassword,
    ];

    const result = await db.query(query, values);
    const row = result.rows[0];
    return {
      ...row,
      floor_count: Number(row.floor_count) || 1,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
    };
  },

  /**
   * Update home details
   */
  updateHome: async (homeId: string, ownerId: string, data: UpdateHomeDTO): Promise<Home | null> => {
    const current = await homeService.getHomeById(homeId, ownerId);
    if (!current) return null;

    let encryptedWifiPassword: string | undefined = undefined;
    if (data.wifi_password !== undefined) {
      encryptedWifiPassword = data.wifi_password ? encryptSecret(data.wifi_password) : '';
    }

    const query = `
      UPDATE homes SET
        name = COALESCE($1, name),
        property_type = COALESCE($2, property_type),
        floor_count = COALESCE($3, floor_count),
        address_line = COALESCE($4, address_line),
        city = COALESCE($5, city),
        latitude = COALESCE($6, latitude),
        longitude = COALESCE($7, longitude),
        timezone = COALESCE($8, timezone),
        default_wifi_ssid = COALESCE($9, default_wifi_ssid),
        wifi_password_encrypted = CASE WHEN $10::text IS NOT NULL THEN $10::text ELSE wifi_password_encrypted END,
        updated_at = NOW()
      WHERE id = $11 AND owner_id = $12
      RETURNING 
        id, 
        owner_id, 
        name, 
        property_type, 
        floor_count, 
        address_line, 
        city, 
        latitude, 
        longitude, 
        timezone, 
        default_wifi_ssid,
        CASE WHEN wifi_password_encrypted IS NOT NULL AND wifi_password_encrypted <> '' THEN true ELSE false END as has_wifi_configured,
        created_at, 
        updated_at
    `;

    const values = [
      data.name ? data.name.trim() : null,
      data.property_type || null,
      data.floor_count !== undefined ? Math.max(1, Number(data.floor_count)) : null,
      data.address_line !== undefined ? (data.address_line ? data.address_line.trim() : null) : null,
      data.city !== undefined ? (data.city ? data.city.trim() : null) : null,
      data.latitude !== undefined ? data.latitude : null,
      data.longitude !== undefined ? data.longitude : null,
      data.timezone || null,
      data.default_wifi_ssid !== undefined ? (data.default_wifi_ssid ? data.default_wifi_ssid.trim() : null) : null,
      encryptedWifiPassword !== undefined ? encryptedWifiPassword : null,
      homeId,
      ownerId,
    ];

    const result = await db.query(query, values);
    const row = result.rows[0];
    return {
      ...row,
      floor_count: Number(row.floor_count) || 1,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
    };
  },

  /**
   * Delete home property
   */
  deleteHome: async (homeId: string, ownerId: string): Promise<boolean> => {
    const result = await db.query('DELETE FROM homes WHERE id = $1 AND owner_id = $2', [homeId, ownerId]);
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Generates a signed share token payload for QR code invitation
   */
  generateSharePayload: async (homeId: string, ownerId: string): Promise<{ shareToken: string; qrData: string }> => {
    const home = await homeService.getHomeById(homeId, ownerId);
    if (!home) throw new Error('Home not found or unauthorized');

    const payload = {
      type: 'neuro_home_invite',
      homeId: home.id,
      homeName: home.name,
      propertyType: home.property_type,
      ownerId: home.owner_id,
      accessLevel: 'Full access',
      issuedAt: Date.now(),
    };

    const shareToken = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });
    const qrData = JSON.stringify({
      schema: 'neurolinx://invite',
      token: shareToken,
      homeId: home.id,
      name: home.name,
      access: 'Full access',
    });

    return { shareToken, qrData };
  },

  /**
   * Get all rooms for a home
   */
  getRoomsByHome: async (homeId: string): Promise<Room[]> => {
    const result = await db.query(
      'SELECT id, home_id, name, created_at, updated_at FROM rooms WHERE home_id = $1 ORDER BY created_at ASC',
      [homeId]
    );
    return result.rows;
  },

  /**
   * Create a new room in a home
   */
  createRoom: async (homeId: string, name: string): Promise<Room> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Room name is required');
    const result = await db.query(
      'INSERT INTO rooms (home_id, name) VALUES ($1, $2) RETURNING id, home_id, name, created_at, updated_at',
      [homeId, trimmed]
    );
    return result.rows[0];
  },

  /**
   * Delete a room from a home
   */
  deleteRoom: async (homeId: string, roomId: string): Promise<boolean> => {
    const result = await db.query(
      'DELETE FROM rooms WHERE id = $1 AND home_id = $2',
      [roomId, homeId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Record a member email invitation
   */
  sendInvitation: async (homeId: string, invitedBy: string, email: string, accessLevel: string = 'Full access'): Promise<HomeInvitation> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) throw new Error('Email address is required');

    const result = await db.query(
      `INSERT INTO home_invitations (home_id, invited_by, email, access_level, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, home_id, invited_by, email, access_level, status, created_at`,
      [homeId, invitedBy, trimmedEmail, accessLevel]
    );
    return result.rows[0];
  },

  /**
   * List pending invitations for a home
   */
  getInvitations: async (homeId: string): Promise<HomeInvitation[]> => {
    const result = await db.query(
      'SELECT id, home_id, invited_by, email, access_level, status, created_at FROM home_invitations WHERE home_id = $1 ORDER BY created_at DESC',
      [homeId]
    );
    return result.rows;
  },
};
