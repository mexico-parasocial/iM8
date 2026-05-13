-- Drop indices first (they will be dropped automatically with the table as well, but explicit for clarity)
DROP INDEX IF EXISTS idx_missing_blobs_created_date;
DROP INDEX IF EXISTS uq_missing_blobs_did_cid;

-- Drop the table
DROP TABLE IF EXISTS missing_blobs;