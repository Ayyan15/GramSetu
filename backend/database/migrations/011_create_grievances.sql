-- Migration 011: Grievances
-- Citizens can submit complaints/grievances about public infrastructure or services.

CREATE TABLE grievances (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    panchayat_id    INTEGER      NOT NULL REFERENCES panchayats(id) ON DELETE RESTRICT,
    citizen_id      UUID         NOT NULL REFERENCES users(id)      ON DELETE RESTRICT,
    assigned_to     UUID         REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(300) NOT NULL,
    description     TEXT         NOT NULL,
    category        VARCHAR(50)  NOT NULL DEFAULT 'other',
    location_text   TEXT,
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    status          VARCHAR(30)  NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED')),
    priority        VARCHAR(10)  NOT NULL DEFAULT 'NORMAL'
                        CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
    resolution_note TEXT,
    resolved_at     TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grievances_panchayat  ON grievances(panchayat_id);
CREATE INDEX idx_grievances_citizen    ON grievances(citizen_id);
CREATE INDEX idx_grievances_assigned   ON grievances(assigned_to);
CREATE INDEX idx_grievances_status     ON grievances(status);
CREATE INDEX idx_grievances_category   ON grievances(category);
CREATE INDEX idx_grievances_submitted  ON grievances(submitted_at DESC);

COMMENT ON TABLE  grievances          IS 'Citizen complaints and grievances';
COMMENT ON COLUMN grievances.category IS 'road | water | electricity | sanitation | other';
COMMENT ON COLUMN grievances.status   IS 'OPEN → ASSIGNED → IN_PROGRESS → RESOLVED|CLOSED|REJECTED';
