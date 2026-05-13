-- Add up migration script here

CREATE TYPE blob_type AS ENUM ('repo', 'blob', 'prefs');

CREATE TABLE blobs
(
    id          SERIAL PRIMARY KEY,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_did TEXT                     NOT NULL REFERENCES accounts (did),
    size        BIGINT                   NOT NULL,
    type        blob_type                NOT NULL,
    cid_or_rev  TEXT                     NOT NULL UNIQUE
);

CREATE INDEX idx_blobs_account_did ON blobs (account_did);
create index idx_blobs_cid on blobs (cid_or_rev);