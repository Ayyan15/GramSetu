-- Migration 007: Create audit_logs table
-- Immutable, append-only record of all sensitive actions.
-- Application code NEVER issues UPDATE or DELETE on this table.

CREATE TABLE audit_logs (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         REFERENCES users(id)       ON DELETE SET NULL,
    panchayat_id INTEGER      REFERENCES panchayats(id)  ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(50),
    entity_id    TEXT,
    old_values   JSONB,
    new_values   JSONB,
    ip_address   INET,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id      ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_panchayat    ON audit_logs(panchayat_id);
CREATE INDEX idx_audit_logs_action       ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at   ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity       ON audit_logs(entity_type, entity_id);

COMMENT ON TABLE  audit_logs            IS 'Append-only audit trail. Never UPDATE or DELETE.';
COMMENT ON COLUMN audit_logs.user_id    IS 'NULL for anonymous or system-initiated actions.';
COMMENT ON COLUMN audit_logs.old_values IS 'JSONB state before the change. NULL for create operations.';
COMMENT ON COLUMN audit_logs.new_values IS 'JSONB state after the change. NULL for delete operations.';
