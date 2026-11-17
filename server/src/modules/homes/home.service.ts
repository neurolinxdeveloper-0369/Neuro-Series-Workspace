import { db } from '../../config/database.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import { createHash, randomBytes } from 'node:crypto';
import type { Home, CreateHomeDTO, UpdateHomeDTO, Room, HomeInvitation } from './home.types.js';

function digestInvite(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

async function parsePermission(homeId: string, value: unknown) {
  if (value === undefined) return { role: 'control', roomIds: null, deviceIds: null };
  if (!value || typeof value !== 'object') throw new Error('Invalid access settings');
  const { role, roomIds, deviceIds } = value as Record<string, unknown>;
  if (role !== 'view' && role !== 'control') throw new Error('Select a valid role');
  if (roomIds == null && deviceIds == null) return { role, roomIds: null, deviceIds: null };
  function ids(input: unknown): string[] {
    if (!Array.isArray(input) || input.length > 100 || input.some(item => typeof item !== 'string' ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(item))) throw new Error('Invalid location selection');
    return [...new Set(input.map(item => item.toLowerCase()))];
  }
  const rooms = ids(roomIds ?? []);
  const devices = ids(deviceIds ?? []);
  if (!rooms.length && !devices.length) throw new Error('Select at least one room or device');
  const result = await db.query(
    `SELECT (SELECT count(*) FROM rooms WHERE home_id = $1 AND id = ANY($2::uuid[]))
         + (SELECT count(*) FROM devices WHERE home_id = $1 AND id = ANY($3::uuid[])) AS count`,
    [homeId, rooms, devices]
  );
  if (Number(result.rows[0].count) !== rooms.length + devices.length) throw new Error('Selection is outside this location');
  return { role, roomIds: rooms, deviceIds: devices };
}

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
      ALTER TABLE home_invitations ADD COLUMN IF NOT EXISTS code_digest TEXT;
      ALTER TABLE home_invitations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_home_invite_code ON home_invitations(code_digest);

      CREATE TABLE IF NOT EXISTS home_members (
        home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (home_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_home_members_user ON home_members(user_id);
      ALTER TABLE home_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'control' CHECK (role IN ('view', 'control'));
      ALTER TABLE home_members ADD COLUMN IF NOT EXISTS room_ids UUID[];
      ALTER TABLE home_members ADD COLUMN IF NOT EXISTS device_ids UUID[];
      ALTER TABLE home_invitations ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'control' CHECK (role IN ('view', 'control'));
      ALTER TABLE home_invitations ADD COLUMN IF NOT EXISTS room_ids UUID[];
      ALTER TABLE home_invitations ADD COLUMN IF NOT EXISTS device_ids UUID[];
    `;
    try {
      await db.query(query);
      console.log('✅ Homes, Rooms & Invitations tables initialized in PostgreSQL');
    } catch (error) {
      console.error('❌ Failed to verify database tables in PostgreSQL:', error);
      throw error;
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

  getAccessibleHomes: async (userId: string): Promise<Home[]> => {
    const owned = await homeService.getHomesByOwner(userId);
    const result = await db.query(
      `SELECT h.id, h.owner_id, h.name, h.property_type, h.floor_count, h.timezone,
              h.created_at, h.updated_at, NULL AS address_line, NULL AS city,
              NULL AS latitude, NULL AS longitude, NULL AS default_wifi_ssid
       FROM homes h JOIN home_members m ON m.home_id = h.id
       WHERE m.user_id = $1 AND h.owner_id <> $1 ORDER BY h.created_at`,
      [userId]
    );
    return [...owned, ...result.rows];
  },

  createInvite: async (homeId: string, ownerId: string, email?: string, access?: unknown) => {
    const permission = await parsePermission(homeId, access);
    const targetEmail = email?.trim().toLowerCase() ?? '';
    if (targetEmail && (targetEmail.length > 255 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail))) {
      throw new Error('Enter a valid email address');
    }
    const code = randomBytes(24).toString('base64url');
    const result = await db.query(
      `INSERT INTO home_invitations (home_id, invited_by, email, access_level, code_digest, expires_at, role, room_ids, device_ids)
       SELECT id, owner_id, $3, CASE WHEN $5 = 'view' THEN 'View only' ELSE 'Device control' END, $4, NOW() + INTERVAL '7 days', $5, $6, $7
       FROM homes WHERE id = $1 AND owner_id = $2
       RETURNING id, expires_at`,
      [homeId, ownerId, targetEmail, digestInvite(code), permission.role, permission.roomIds, permission.deviceIds]
    );
    if (!result.rowCount) throw new Error('Location not found');
    return { id: result.rows[0].id, code, expiresAt: result.rows[0].expires_at };
  },

  redeemInvite: async (code: string, userId: string): Promise<string | null> => {
    if (!/^[A-Za-z0-9_-]{32}$/.test(code)) return null;
    const result = await db.query(
      `WITH redeemed AS (
         UPDATE home_invitations i SET status = 'accepted'
         FROM users u, homes h
         WHERE i.code_digest = $1 AND i.status = 'pending' AND i.expires_at > NOW()
           AND u.id = $2 AND h.id = i.home_id AND h.owner_id <> u.id
           AND (i.email = '' OR LOWER(u.email) = i.email)
         RETURNING i.home_id, i.role, i.room_ids, i.device_ids
       ), membership AS (
         INSERT INTO home_members (home_id, user_id, role, room_ids, device_ids)
         SELECT home_id, $2, role, room_ids, device_ids FROM redeemed ON CONFLICT DO NOTHING
       )
       SELECT home_id FROM redeemed`,
      [digestInvite(code), userId]
    );
    return result.rows[0]?.home_id ?? null;
  },

  listMembers: async (homeId: string) => {
    const result = await db.query(
      'SELECT u.id, u.full_name, m.role, m.room_ids, m.device_ids FROM home_members m JOIN users u ON u.id = m.user_id WHERE m.home_id = $1 ORDER BY u.full_name',
      [homeId]
    );
    return result.rows;
  },

  updateMember: async (homeId: string, userId: string, access: unknown) => {
    const permission = await parsePermission(homeId, access);
    const result = await db.query(
      'UPDATE home_members SET role = $3, room_ids = $4, device_ids = $5 WHERE home_id = $1 AND user_id::text = $2',
      [homeId, userId, permission.role, permission.roomIds, permission.deviceIds]
    );
    return Boolean(result.rowCount);
  },

  removeMember: async (homeId: string, userId: string): Promise<boolean> => {
    const result = await db.query('DELETE FROM home_members WHERE home_id = $1 AND user_id::text = $2', [homeId, userId]);
    return Boolean(result.rowCount);
  },

  revokeInvite: async (homeId: string, id: string): Promise<boolean> => {
    const result = await db.query(
      "UPDATE home_invitations SET status = 'revoked' WHERE home_id = $1 AND id::text = $2 AND status = 'pending'",
      [homeId, id]
    );
    return Boolean(result.rowCount);
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
   * Get decrypted Wi-Fi credentials for hardware provisioning
   */
  getHomeWifiCredentials: async (homeId: string, ownerId: string): Promise<{ ssid: string; password: string }> => {
    const query = `
      SELECT default_wifi_ssid, wifi_password_encrypted
      FROM homes
      WHERE id = $1 AND owner_id = $2
    `;
    const result = await db.query(query, [homeId, ownerId]);
    if (result.rows.length === 0) {
      return { ssid: '', password: '' };
    }
    const row = result.rows[0];
    let password = '';
    if (row.wifi_password_encrypted) {
      try {
        password = decryptSecret(row.wifi_password_encrypted);
      } catch {
        password = '';
      }
    }
    return {
      ssid: row.default_wifi_ssid || '',
      password: password,
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
   * Get all rooms for a home
   */
  getRoomsByHome: async (homeId: string, userId?: string): Promise<Room[]> => {
    const result = await db.query(
      `SELECT r.id, r.home_id, r.name, r.created_at, r.updated_at FROM rooms r
       JOIN homes h ON h.id = r.home_id WHERE r.home_id = $1 AND ($2::uuid IS NULL OR h.owner_id = $2 OR EXISTS (
         SELECT 1 FROM home_members m WHERE m.home_id = r.home_id AND m.user_id = $2 AND (
           m.room_ids IS NULL AND m.device_ids IS NULL OR r.id = ANY(m.room_ids)
           OR EXISTS (SELECT 1 FROM devices d WHERE d.home_id = r.home_id AND d.room_id = r.id AND d.id = ANY(m.device_ids))
         )
       )) ORDER BY r.created_at ASC`, [homeId, userId ?? null]
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
   * List pending invitations for a home
   */
  getInvitations: async (homeId: string): Promise<HomeInvitation[]> => {
    const result = await db.query(
      `SELECT id, home_id, invited_by, email, access_level, status, created_at
       FROM home_invitations WHERE home_id = $1 AND status = 'pending' AND expires_at > NOW() ORDER BY created_at DESC`,
      [homeId]
    );
    return result.rows;
  },
};
