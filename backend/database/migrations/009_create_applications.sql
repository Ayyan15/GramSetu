-- Migration 009: Citizen applications
-- Tracks certificate/service applications submitted by citizens.

CREATE TABLE applications (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    panchayat_id    INTEGER      NOT NULL REFERENCES panchayats(id) ON DELETE RESTRICT,
    service_id      INTEGER      NOT NULL REFERENCES services(id)   ON DELETE RESTRICT,
    citizen_id      UUID         NOT NULL REFERENCES users(id)      ON DELETE RESTRICT,
    status          VARCHAR(30)  NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CORRECTIONS_NEEDED')),
    priority        VARCHAR(10)  NOT NULL DEFAULT 'NORMAL'
                        CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
    remarks         TEXT,
    reviewed_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_panchayat  ON applications(panchayat_id);
CREATE INDEX idx_applications_citizen    ON applications(citizen_id);
CREATE INDEX idx_applications_service    ON applications(service_id);
CREATE INDEX idx_applications_status     ON applications(status);
CREATE INDEX idx_applications_submitted  ON applications(submitted_at DESC);

COMMENT ON TABLE  applications         IS 'Service/certificate requests from citizens';
COMMENT ON COLUMN applications.status  IS 'PENDING → UNDER_REVIEW → APPROVED|REJECTED|CORRECTIONS_NEEDED';
