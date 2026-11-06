-- Migration 008: Services catalogue
-- Defines certificate/document services offered by the Panchayat.

CREATE TABLE services (
    id              SERIAL       PRIMARY KEY,
    panchayat_id    INTEGER      NOT NULL REFERENCES panchayats(id) ON DELETE RESTRICT,
    name            VARCHAR(200) NOT NULL,
    name_marathi    VARCHAR(200),
    description     TEXT,
    category        VARCHAR(50)  NOT NULL DEFAULT 'certificate',
    required_docs   JSONB        NOT NULL DEFAULT '[]',
    processing_days INTEGER      NOT NULL DEFAULT 7,
    fee_amount      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_panchayat ON services(panchayat_id);
CREATE INDEX idx_services_active    ON services(is_active);

COMMENT ON TABLE  services               IS 'Services/certificates offered by the panchayat';
COMMENT ON COLUMN services.category      IS 'certificate | utility | welfare | other';
COMMENT ON COLUMN services.required_docs IS 'JSON array of required document names';
