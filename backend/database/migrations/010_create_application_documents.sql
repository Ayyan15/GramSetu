-- Migration 010: Application documents
-- Stores metadata for files uploaded with applications.
-- Actual file bytes are stored on the filesystem; only paths are stored here.

CREATE TABLE application_documents (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID         NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    document_name   VARCHAR(200) NOT NULL,
    file_path       TEXT         NOT NULL,
    file_size_bytes INTEGER,
    mime_type       VARCHAR(100),
    uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_docs_application ON application_documents(application_id);
