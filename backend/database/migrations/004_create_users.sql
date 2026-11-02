-- Migration 004: Create users table
-- Core authentication and authorization table.
-- UUID primary key prevents sequential ID enumeration via the API.

CREATE TABLE users (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    panchayat_id          INTEGER     NOT NULL REFERENCES panchayats(id) ON DELETE RESTRICT,
    role_id               INTEGER     NOT NULL REFERENCES roles(id)      ON DELETE RESTRICT,
    email                 VARCHAR(254) UNIQUE,
    mobile                VARCHAR(15)  UNIQUE,
    password_hash         VARCHAR(72)  NOT NULL,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    is_email_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
    failed_login_attempts SMALLINT     NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT users_must_have_contact CHECK (
        email IS NOT NULL OR mobile IS NOT NULL
    )
);

-- Partial indexes for query performance (NULLs excluded)
CREATE INDEX idx_users_panchayat_id ON users(panchayat_id);
CREATE INDEX idx_users_role_id      ON users(role_id);
CREATE INDEX idx_users_email        ON users(email)  WHERE email  IS NOT NULL;
CREATE INDEX idx_users_mobile       ON users(mobile) WHERE mobile IS NOT NULL;
CREATE INDEX idx_users_is_active    ON users(is_active);

COMMENT ON TABLE  users                        IS 'Core authentication table. password_hash is never returned by any API.';
COMMENT ON COLUMN users.locked_until           IS 'NULL = not locked. Set after 5 consecutive failed logins (15-minute lock).';
COMMENT ON COLUMN users.failed_login_attempts  IS 'Resets to 0 on successful login.';
COMMENT ON COLUMN users.is_active              IS 'Soft-delete flag. Row is never physically removed.';
