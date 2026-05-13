-- Drop the existing unique constraint on cid_or_rev alone so that
-- different accounts can have the same CID.
ALTER TABLE blobs DROP CONSTRAINT blobs_cid_or_rev_key;

-- Add a composite unique constraint: the same account cannot have
-- duplicate cid_or_rev values, but different accounts can.
ALTER TABLE blobs ADD CONSTRAINT blobs_account_did_cid_or_rev_key UNIQUE (account_did, cid_or_rev);
