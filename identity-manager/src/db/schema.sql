-- M8 Identity Manager Schema v1

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  authorization_server TEXT NOT NULL DEFAULT '',
  authenticated_at TEXT NOT NULL DEFAULT (datetime('now')),
  pds_safety_json TEXT NOT NULL DEFAULT '{}',
  active_persona_id TEXT NOT NULL DEFAULT 'orbit',
  active_surface_id TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provider_status (
  session_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT 'offline',
  compatibility TEXT NOT NULL DEFAULT 'needs-review',
  policy_record TEXT NOT NULL DEFAULT '',
  compatibility_record TEXT NOT NULL DEFAULT '',
  last_sync_at TEXT NOT NULL DEFAULT (datetime('now')),
  supported_claims_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (session_id, provider_id),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_kind TEXT NOT NULL,
  surface TEXT NOT NULL,
  requested_claims_json TEXT NOT NULL,
  proof_mode TEXT NOT NULL DEFAULT 'proof-only',
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  issued_at TEXT,
  last_used_at TEXT,
  expires_at TEXT,
  grant_id TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  session_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_kind TEXT NOT NULL,
  surface TEXT NOT NULL,
  requested_claims_json TEXT NOT NULL,
  proof_mode TEXT NOT NULL DEFAULT 'proof-only',
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  issued_at TEXT,
  last_used_at TEXT,
  expires_at TEXT,
  proof_artifact_ids_json TEXT NOT NULL DEFAULT '[]',
  issuer_id TEXT NOT NULL DEFAULT 'm8.broker',
  review_note TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS proof_artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  request_id TEXT,
  claim_type TEXT NOT NULL,
  requested_value TEXT,
  outcome TEXT NOT NULL,
  statement TEXT NOT NULL DEFAULT '',
  proof_mode TEXT NOT NULL DEFAULT 'proof-only',
  issuer_id TEXT NOT NULL DEFAULT 'm8.broker',
  verifier_id TEXT NOT NULL DEFAULT 'm8.broker',
  audience_app_id TEXT NOT NULL,
  audience_app_name TEXT NOT NULL,
  surface TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (grant_id) REFERENCES grants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS identity_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  audience_app_id TEXT NOT NULL,
  audience_app_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  merchant_identifier TEXT NOT NULL,
  requested_elements_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claim_requests_session ON claim_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);
CREATE INDEX IF NOT EXISTS idx_grants_session ON grants(session_id);
CREATE INDEX IF NOT EXISTS idx_grants_status ON grants(status);
CREATE INDEX IF NOT EXISTS idx_grants_app_id ON grants(app_id);
CREATE INDEX IF NOT EXISTS idx_proof_artifacts_session ON proof_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_proof_artifacts_grant ON proof_artifacts(grant_id);
CREATE INDEX IF NOT EXISTS idx_proof_artifacts_status ON proof_artifacts(status);
CREATE INDEX IF NOT EXISTS idx_ledger_session ON ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_identity_requests_session ON identity_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_identity_requests_status ON identity_requests(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id);
