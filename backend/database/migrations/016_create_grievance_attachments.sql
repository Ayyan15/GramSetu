-- Migration 016: Private evidence attached to grievances.

CREATE TABLE grievance_attachments (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    grievance_id    UUID         NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
    panchayat_id    INTEGER      NOT NULL REFERENCES panchayats(id) ON DELETE RESTRICT,
    uploaded_by     UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    file_size       BIGINT       NOT NULL,
    storage_path    TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT grievance_attachments_filename_check
        CHECK (NULLIF(BTRIM(original_filename), '') IS NOT NULL),
    CONSTRAINT grievance_attachments_size_check
        CHECK (file_size > 0 AND file_size <= 5242880),
    CONSTRAINT grievance_attachments_mime_check
        CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
    CONSTRAINT grievance_attachments_storage_path_check
        CHECK (storage_path ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$')
);

CREATE INDEX idx_grievance_attachments_grievance
    ON grievance_attachments(grievance_id);
CREATE INDEX idx_grievance_attachments_panchayat
    ON grievance_attachments(panchayat_id);
CREATE INDEX idx_grievance_attachments_uploaded_by
    ON grievance_attachments(uploaded_by);

COMMENT ON TABLE grievance_attachments IS
    'Private evidence files attached to grievances; physical paths are never public URLs.';
