-- =========================================================================
-- Neuro Series Authentication & User Database Schema
-- Database: PostgreSQL 14+
-- =========================================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150),
    email VARCHAR(255) UNIQUE,              -- Nullable if user only registered via phone
    phone_number VARCHAR(20) UNIQUE,        -- E.164 format (+91...), nullable if only Google
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Auth Identities (OAuth Providers & Phone Logins) Table
CREATE TABLE IF NOT EXISTS auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,          -- 'google' OR 'phone'
    provider_key VARCHAR(255) NOT NULL,     -- Google 'sub' value OR verified phone '+919876543210'
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uk_provider_key UNIQUE (provider, provider_key)
);

-- 3. Performance Indexes for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_lookup ON auth_identities(provider, provider_key);

-- 4. Auto-update trigger for updated_at column
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

-- 5. Homes Table (Properties / Locations)
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

-- 6. Auto-update trigger for homes
DROP TRIGGER IF EXISTS trg_homes_updated_at ON homes;
CREATE TRIGGER trg_homes_updated_at
BEFORE UPDATE ON homes
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

-- 7. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_home_id ON rooms(home_id);

-- 8. Home Invitations Table
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

-- 9. Physical Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,     -- Assigns physical board to room
    device_id VARCHAR(64) NOT NULL UNIQUE,                    -- e.g., 'nt8k-BC88-TP8'
    mac_4 VARCHAR(4) NOT NULL,
    model_code VARCHAR(30) NOT NULL,
    custom_name VARCHAR(100) NOT NULL,
    wifi_ssid VARCHAR(64) NOT NULL,                           -- Connected Wi-Fi SSID
    rssi INT DEFAULT NULL,                                    -- Signal strength in dBm (NULL until polled)
    ip_address VARCHAR(45),
    firmware_version VARCHAR(30),
    is_online BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_room_id ON devices(room_id);
CREATE INDEX IF NOT EXISTS idx_devices_home_id ON devices(home_id);

-- 10. Device Endpoints Table (Child Table)
CREATE TABLE IF NOT EXISTS device_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    endpoint_index INT NOT NULL,                              -- 1 to N
    name VARCHAR(100) NOT NULL,                               -- "Switch 1", "Phase R", "Tank Level"
    endpoint_type VARCHAR(20) NOT NULL CHECK (endpoint_type IN ('RELAY', 'PHASE', 'SENSOR')),
    state JSONB DEFAULT '{"status": "OFF"}',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, endpoint_index)
);

CREATE INDEX IF NOT EXISTS idx_endpoints_device_id ON device_endpoints(device_id);

