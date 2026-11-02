-- Migration 002: Create panchayats table
-- Stores the identity of the Gram Panchayat this installation serves.
-- Phase 2 supports one active panchayat; panchayat_id FK enables future expansion.

CREATE TABLE panchayats (
    id             SERIAL       PRIMARY KEY,
    name           VARCHAR(200) NOT NULL,
    marathi_name   VARCHAR(200),
    village        VARCHAR(100) NOT NULL,
    taluka         VARCHAR(100),
    district       VARCHAR(100) NOT NULL,
    state          VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    country        VARCHAR(100) NOT NULL DEFAULT 'India',
    pincode        CHAR(6),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  panchayats               IS 'Gram Panchayat entity. One active row per installation in Phase 2.';
COMMENT ON COLUMN panchayats.name          IS 'Official English name e.g. Kini Gram Panchayat';
COMMENT ON COLUMN panchayats.marathi_name  IS 'Official Marathi name e.g. किनी ग्रामपंचायत';
COMMENT ON COLUMN panchayats.taluka        IS 'NULL until administratively verified.';
COMMENT ON COLUMN panchayats.pincode       IS 'NULL until administratively verified.';
COMMENT ON COLUMN panchayats.is_active     IS 'Soft-disable without data loss.';
