-- Create demo_items table for example reader/writer
CREATE TABLE IF NOT EXISTS accounts
(
    id          BIGSERIAL PRIMARY KEY,
    did         TEXT        NOT NULL UNIQUE,
    pds_host    TEXT        NOT NULL,
    active      BOOLEAN     NOT NULL DEFAULT true,
    repo_rev    TEXT,
    pds_sign_up BOOLEAN     NOT NULL DEFAULT false,
    last_backup TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Add up migration script here

CREATE INDEX idx_accounts_did ON accounts (did);
CREATE INDEX idx_accounts_pds_host ON accounts (pds_host);