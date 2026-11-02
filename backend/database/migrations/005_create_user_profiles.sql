-- Migration 005: Create user_profiles table
-- Extended personal details. 1-to-1 with users.
-- Separated so auth queries (login, token validation) never need to join this table.

CREATE TABLE user_profiles (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name         VARCHAR(150) NOT NULL,
    date_of_birth     DATE,
    gender            VARCHAR(30)  CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
    address_line      TEXT,
    village           VARCHAR(100),
    pincode           CHAR(6),
    aadhaar_last4     CHAR(4),
    profile_photo_url TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

COMMENT ON TABLE  user_profiles               IS '1-to-1 extension of users. Never included in auth queries.';
COMMENT ON COLUMN user_profiles.aadhaar_last4 IS 'Last 4 digits of Aadhaar ONLY. Full number must never be stored.';
