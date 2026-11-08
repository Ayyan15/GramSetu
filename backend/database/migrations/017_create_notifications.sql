-- Migration 017: User notifications

CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    panchayat_id      INTEGER NOT NULL REFERENCES panchayats(id) ON DELETE RESTRICT,
    recipient_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    notification_type VARCHAR(60) NOT NULL,
    title             VARCHAR(200) NOT NULL,
    message           TEXT NOT NULL,
    reference_type    VARCHAR(40),
    reference_id     UUID,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read           BOOLEAN NOT NULL DEFAULT FALSE,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notifications_type_check CHECK (
        notification_type IN (
            'APPLICATION_SUBMITTED', 'APPLICATION_STATUS_UPDATED',
            'DOCUMENT_UPLOADED', 'DOCUMENT_VERIFIED',
            'GRIEVANCE_SUBMITTED', 'GRIEVANCE_ASSIGNED',
            'GRIEVANCE_REASSIGNED', 'GRIEVANCE_STATUS_UPDATED',
            'GRIEVANCE_ATTACHMENT_UPLOADED'
        )
    ),
    CONSTRAINT notifications_read_state_check CHECK (
        (is_read = FALSE AND read_at IS NULL)
        OR (is_read = TRUE AND read_at IS NOT NULL)
    ),
    CONSTRAINT notifications_title_check CHECK (NULLIF(BTRIM(title), '') IS NOT NULL),
    CONSTRAINT notifications_message_check CHECK (NULLIF(BTRIM(message), '') IS NOT NULL),
    CONSTRAINT notifications_reference_type_check CHECK (
        reference_type IS NULL OR reference_type IN ('application', 'application_document', 'grievance', 'grievance_attachment')
    )
);

CREATE INDEX idx_notifications_recipient_created
    ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_panchayat
    ON notifications(panchayat_id);
CREATE INDEX idx_notifications_created
    ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread
    ON notifications(recipient_id, created_at DESC)
    WHERE is_read = FALSE;
