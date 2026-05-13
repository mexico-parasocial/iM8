-- Migration: Create table to track whole-network backup start times
CREATE TABLE IF NOT EXISTS network_backup_runs (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for recent lookups
CREATE INDEX IF NOT EXISTS idx_network_backup_runs_started_at ON network_backup_runs (started_at DESC);
