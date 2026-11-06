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
