-- Add up migration script here
CREATE TABLE pds_hosts
(
    pds_host  TEXT PRIMARY KEY,
    created   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active    BOOLEAN                  NOT NULL DEFAULT true,
    admin_did TEXT
);

-- Create an index on the admin_did field for faster lookups
CREATE INDEX idx_pds_hosts_admin_did ON pds_hosts (admin_did);
