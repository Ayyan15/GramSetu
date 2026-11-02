-- Migration 006: Create refresh_tokens table
-- Supports JWT refresh flow and server-side logout/revocation.
-- Stores SHA-256 HASH of the raw token — the raw value only lives in the client response.

CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_active     ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE  refresh_tokens            IS 'Hashed refresh tokens. Setting revoked_at invalidates the session (logout).';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hex of the raw refresh token. Raw value never stored.';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'NULL = valid session. Non-NULL = logged out or rotated.';
