-- Migration: Add last_backup_start to pds_hosts
ALTER TABLE pds_hosts
    ADD COLUMN IF NOT EXISTS last_backup_start TIMESTAMPTZ;
