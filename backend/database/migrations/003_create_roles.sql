-- Migration 003: Create roles lookup table
-- Values are fixed at seed time. The API never exposes a write endpoint for roles.

CREATE TABLE roles (
    id          SERIAL      PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  roles      IS 'Fixed role lookup: CITIZEN, PANCHAYAT_OFFICIAL, FIELD_WORKER, SYSTEM_ADMIN';
COMMENT ON COLUMN roles.name IS 'Uppercase enum-style string used by application code';
