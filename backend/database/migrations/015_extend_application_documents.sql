-- Migration 015: Extend application documents for secure storage and review.
-- Existing records remain LEGACY records with their original file_path preserved.
-- New records use PRIVATE storage and an opaque server-generated filename.

ALTER TABLE application_documents
    ADD COLUMN original_filename VARCHAR(255),
    ADD COLUMN stored_filename   VARCHAR(255),
    ADD COLUMN document_type     VARCHAR(100),
    ADD COLUMN storage_type      VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
    ADD COLUMN legacy_file_path  TEXT,
    ADD COLUMN panchayat_id      INTEGER,
    ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN verified_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN verified_at       TIMESTAMPTZ,
    ADD COLUMN rejection_reason  TEXT,
    ADD COLUMN created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM application_documents
        WHERE file_path IS NULL OR BTRIM(file_path) = ''
    ) THEN
        RAISE EXCEPTION
            'Migration 015 cannot continue: application_documents contains an empty file_path.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM application_documents d
        LEFT JOIN applications a ON a.id = d.application_id
        WHERE a.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 015 cannot continue: application_documents contains an invalid application_id.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM application_documents d
        JOIN applications a ON a.id = d.application_id
        LEFT JOIN panchayats p ON p.id = a.panchayat_id
        WHERE p.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 015 cannot continue: an application document is linked to an application with no valid Panchayat.';
    END IF;
END;
$migration$;

UPDATE application_documents AS d
SET    original_filename = d.document_name,
       document_type = d.document_name,
       storage_type = 'LEGACY',
       legacy_file_path = d.file_path,
       panchayat_id = a.panchayat_id,
       created_at = d.uploaded_at,
       updated_at = d.uploaded_at
FROM   applications AS a
WHERE  a.id = d.application_id;

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM application_documents
        WHERE storage_type = 'LEGACY'
          AND (legacy_file_path IS NULL OR BTRIM(legacy_file_path) = '')
    ) THEN
        RAISE EXCEPTION
            'Migration 015 cannot continue: a legacy document has no preserved file location.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM application_documents
        WHERE BTRIM(document_type) = ''
    ) THEN
        RAISE EXCEPTION
            'Migration 015 cannot continue: a document has an empty document type.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM application_documents
        WHERE verification_status <> 'REJECTED'
        GROUP BY application_id,
                 LOWER(REGEXP_REPLACE(BTRIM(document_type), '\s+', ' ', 'g'))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Migration 015 cannot continue: duplicate active document types exist for an application.';
    END IF;
END;
$migration$;

ALTER TABLE application_documents
    ALTER COLUMN original_filename SET NOT NULL,
    ALTER COLUMN document_type SET NOT NULL,
    ALTER COLUMN panchayat_id SET NOT NULL,
    ADD CONSTRAINT app_documents_storage_type_check
        CHECK (storage_type IN ('LEGACY', 'PRIVATE')),
    ADD CONSTRAINT app_documents_storage_location_check
        CHECK (
            (storage_type = 'LEGACY'
             AND NULLIF(BTRIM(legacy_file_path), '') IS NOT NULL
             AND stored_filename IS NULL)
            OR
            (storage_type = 'PRIVATE'
             AND NULLIF(BTRIM(stored_filename), '') IS NOT NULL
             AND legacy_file_path IS NULL)
        ),
    ADD CONSTRAINT app_documents_private_filename_check
        CHECK (
             storage_type = 'LEGACY'
             OR stored_filename ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
        ),
    ADD CONSTRAINT app_documents_panchayat_fk
        FOREIGN KEY (panchayat_id) REFERENCES panchayats(id) ON DELETE RESTRICT,
    ADD CONSTRAINT app_documents_verification_status_check
        CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD CONSTRAINT app_documents_rejection_reason_check
        CHECK (verification_status <> 'REJECTED'
               OR NULLIF(BTRIM(rejection_reason), '') IS NOT NULL);

CREATE INDEX idx_app_docs_panchayat
    ON application_documents(panchayat_id);
CREATE INDEX idx_app_docs_verification
    ON application_documents(verification_status);
CREATE INDEX idx_app_docs_verified_by
    ON application_documents(verified_by);
CREATE UNIQUE INDEX uq_app_docs_active_type
    ON application_documents(
        application_id,
        LOWER(REGEXP_REPLACE(BTRIM(document_type), '\s+', ' ', 'g'))
    )
    WHERE verification_status <> 'REJECTED';

COMMENT ON COLUMN application_documents.stored_filename
    IS 'Opaque server-generated filename for PRIVATE storage; never exposed as a public URL';
COMMENT ON COLUMN application_documents.legacy_file_path
    IS 'Historical path retained for LEGACY records; resolved only inside configured trusted legacy storage';
COMMENT ON COLUMN application_documents.storage_type
    IS 'LEGACY for migrated records, PRIVATE for new server-managed uploads';
COMMENT ON COLUMN application_documents.verification_status
    IS 'PENDING -> APPROVED or REJECTED; reviewed states are terminal';
