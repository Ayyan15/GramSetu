-- Migration 001: Create migration history tracking table
-- Applied by the migration runner before all other migrations.
-- Uses IF NOT EXISTS because the runner may create this table first.

CREATE TABLE IF NOT EXISTS migration_history (
    id           SERIAL       PRIMARY KEY,
    filename     VARCHAR(200) NOT NULL UNIQUE,
    applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
