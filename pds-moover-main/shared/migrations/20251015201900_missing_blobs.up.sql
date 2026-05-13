-- Create missing_blobs table to track blobs that could not be fetched
CREATE TABLE IF NOT EXISTS missing_blobs
(
    id            BIGSERIAL PRIMARY KEY,
    did           TEXT        NOT NULL,
    cid           TEXT        NOT NULL,
    created_date  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure we do not insert duplicates for the same DID + CID pair
CREATE UNIQUE INDEX IF NOT EXISTS uq_missing_blobs_did_cid ON missing_blobs (did, cid);

CREATE INDEX IF NOT EXISTS idx_missing_blobs_created_date ON missing_blobs (created_date);
