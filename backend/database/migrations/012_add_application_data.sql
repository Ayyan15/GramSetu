-- Migration 012: Add dynamic application form data
-- Stores service-specific application responses as a JSONB object.

ALTER TABLE applications
    ADD COLUMN application_data JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD CONSTRAINT applications_application_data_object_check
        CHECK (jsonb_typeof(application_data) = 'object');

COMMENT ON COLUMN applications.application_data IS
    'Service-specific application form responses stored as a JSON object';
