-- Migration 013: Add dynamic service form schemas
-- Stores service-specific application form field definitions as a JSONB array.

ALTER TABLE services
    ADD COLUMN form_schema JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD CONSTRAINT services_form_schema_array_check
        CHECK (jsonb_typeof(form_schema) = 'array');

COMMENT ON COLUMN services.form_schema IS
    'Dynamic service-specific application form field definitions stored as a JSON array';
