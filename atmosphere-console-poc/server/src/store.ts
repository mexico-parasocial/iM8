import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import {
  resolveParaProviderStatus,
  verifyParaClaimFromSeed,
} from '../providers/index.ts'
import {
  createDemoWalletPresentation,
  createIdentityRequest,
  verifyWalletPresentation,
} from './identityWallet.ts'
import type {
  M8IdentityRequest,
  M8IdentityRequestInput,
  M8IdentityVerificationResult,
  M8WalletPresentation,
} from '../../src/contracts/identityWallet.ts'
import type {
  ProofBrokerAppKind,
  ProofBrokerClaimRequest,
  ProofBrokerClaimSpec,
  ProofBrokerClaimType,
  ProofBrokerDisclosureMode,
  ProofBrokerGrant,
  ProofBrokerGrantApproveInput,
  ProofBrokerGrantMutationResult,
  ProofBrokerGrantRequestInput,
  ProofBrokerGrantRevokeInput,
  ProofBrokerGrantStatus,
  ProofBrokerPersona,
  ProofBrokerProofArtifact,
  ProofBrokerProofStatus,
  ProofBrokerSafetySnapshot,
  ProofBrokerSession,
  ProofBrokerSessionStartInput,
  ProofBrokerSessionStartResponse,
  ProofBrokerSurface,
  ProofBrokerSurfaceId,
  ProofBrokerVerifierId,
  ProofBrokerParaProviderStatus,
} from '../../src/contracts/proofBroker.ts'

type SessionRow = {
  session_id: string
  did: string
  handle: string
  display_name: string
  authorization_server: string
  authenticated_at: string
  pds_safety_json: string
  active_persona_id: string
  active_surface_id: ProofBrokerSurfaceId
  created_at: string
  updated_at: string
}

type ProviderStatusRow = {
  session_id: string
  provider_id: 'para.identity'
  display_name: string
  availability: ProofBrokerParaProviderStatus['availability']
  compatibility: ProofBrokerParaProviderStatus['compatibility']
  policy_record: 'com.para.identity'
  compatibility_record: 'app.bsky.graph.verification'
  last_sync_at: string
  supported_claims_json: string
  notes: string
}

type ClaimRequestRow = {
  id: string
  session_id: string
  app_id: string
  app_name: string
  app_kind: string
  surface: ProofBrokerSurfaceId
  requested_claims_json: string
  proof_mode: ProofBrokerDisclosureMode
  status: ProofBrokerGrantStatus
  reason: string
  requested_at: string
  issued_at: string | null
  last_used_at: string | null
  expires_at: string | null
  grant_id: string | null
  review_note: string | null
}

type GrantRow = {
  id: string
  session_id: string
  request_id: string
  app_id: string
  app_name: string
  app_kind: string
  surface: ProofBrokerSurfaceId
  requested_claims_json: string
  proof_mode: ProofBrokerDisclosureMode
  status: ProofBrokerGrantStatus
  reason: string
  requested_at: string
  issued_at: string | null
  last_used_at: string | null
  expires_at: string | null
  proof_artifact_ids_json: string
  issuer_id: ProofBrokerVerifierId
  review_note: string | null
}

type ProofArtifactRow = {
  id: string
  session_id: string
  grant_id: string
  request_id: string
  claim_type: string
  requested_value: string | null
  outcome: ProofBrokerProofArtifact['outcome']
  statement: string
  proof_mode: ProofBrokerDisclosureMode
  issuer_id: ProofBrokerVerifierId
  verifier_id: ProofBrokerVerifierId
  audience_app_id: string
  audience_app_name: string
  surface: ProofBrokerSurfaceId
  reference: string
  status: ProofBrokerProofStatus
  issued_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

type LedgerRow = {
  id: string
  session_id: string
  action: string
  subject: string
  detail: string
  timestamp: string
}

type IdentityRequestRow = {
  id: string
  session_id: string
  nonce: string
  audience_app_id: string
  audience_app_name: string
  purpose: string
  merchant_identifier: string
  requested_elements_json: string
  status: M8IdentityRequest['status']
  created_at: string
  expires_at: string
  used_at: string | null
}

type ProofCheckResult =
  | { status: 'confirmed'; proof: ProofBrokerProofArtifact }
  | { status: 'review-needed'; reason: string }

type SQLInputValue = string | number | bigint | Buffer | null

function nowIso() {
  return new Date().toISOString()
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function parseExpiry(value: string | null | undefined) {
  if (!value) return null
  const numericDays = value.match(/^(\d+)\s+days?$/i)
  if (numericDays) {
    return daysFromNow(Number(numericDays[1]))
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeIdentifier(input: string) {
  const trimmed = input.trim().replace(/^@/, '')

  if (!trimmed) {
    throw new Error('Enter a handle, DID, or service URL')
  }

  if (trimmed.startsWith('did:')) {
    return {
      did: trimmed,
      handle: 'portable.user',
      authorizationServer: 'https://auth.atproto.local',
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const host = new URL(trimmed).host.replace(/^www\./, '')
    return {
      did: `did:web:${host}`,
      handle: host,
      authorizationServer: trimmed,
    }
  }

  const handle = trimmed.includes('.') ? trimmed : `${trimmed}.bsky.social`

  return {
    did: `did:plc:${handle.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20) || 'atmosphere'}`,
    handle,
    authorizationServer: 'https://auth.atproto.local',
  }
}

function normalizeDisplayName(handle: string) {
  const root = handle.split('.')[0].replace(/[-_]/g, ' ') || 'Atmos user'
  return root.charAt(0).toUpperCase() + root.slice(1)
}

function buildSafetySnapshot(handle: string): ProofBrokerSafetySnapshot {
  const lowered = handle.toLowerCase()

  if (lowered.includes('move') || lowered.includes('recover')) {
    return {
      state: 'Needs attention',
      detail: 'Backup exists, but the last repo check found follow-up work.',
      source: 'pdsmoover.network',
      lastBackup: '2 days ago',
    }
  }

  if (lowered.includes('new') || lowered.includes('fresh')) {
    return {
      state: 'Enroll now',
      detail: 'No backup enrollment found yet for this identity.',
      source: 'pdsmoover.network',
      lastBackup: 'Not enrolled',
    }
  }

  return {
    state: 'Backed up',
    detail: 'Repo backup is active with no missing blob alerts.',
    source: 'pdsmoover.network',
    lastBackup: '6 hours ago',
  }
}

function buildPersonas(handle: string): ProofBrokerPersona[] {
  const root = handle.split('.')[0].replace(/[-_]/g, ' ') || 'Atmos user'

  return [
    {
      id: 'orbit',
      name: 'Orbit',
      handle: `@${handle}`,
      role: 'Default identity wallet',
      summary: 'Easy first impression across apps with proof-only sharing.',
      activeSurface: 'public',
      surfaceStates: { public: 'Live', civic: 'Limited', dating: 'Muted' },
    },
    {
      id: 'signal',
      name: 'Signal',
      handle: `@${root}.civic`,
      role: 'Civic proof profile',
      summary: 'For public-interest spaces, trust workflows, and verifiable eligibility.',
      activeSurface: 'civic',
      surfaceStates: { public: 'Limited', civic: 'Live', dating: 'Limited' },
    },
    {
      id: 'spark',
      name: 'Spark',
      handle: `@${root}.spark`,
      role: 'Selective dating profile',
      summary: 'Warm discovery with stronger boundaries and revocable claims.',
      activeSurface: 'dating',
      surfaceStates: { public: 'Muted', civic: 'Limited', dating: 'Live' },
    },
  ]
}

function buildSurfaces(): ProofBrokerSurface[] {
  return [
    {
      id: 'public',
      label: 'Public',
      audience: 'Default social face across the network',
      status: 'Live',
      defaultDisclosureMode: 'proof-only',
    },
    {
      id: 'civic',
      label: 'Civic',
      audience: 'Communities, governance, and public-interest spaces',
      status: 'Live',
      defaultDisclosureMode: 'proof-only',
    },
    {
      id: 'dating',
      label: 'Dating',
      audience: 'Relationship discovery with stronger boundaries',
      status: 'Live',
      defaultDisclosureMode: 'proof-only',
    },
  ]
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T
}

function serializeJson(value: unknown) {
  return JSON.stringify(value)
}

const PARA_CLAIMS: ProofBrokerClaimType[] = [
  'is_verified_public_figure',
  'is_civic_eligible',
  'has_para_verification',
  'has_party_affiliation_match',
]

export class ProofBrokerStore {
  private readonly db: Database.Database

  constructor(dbPath = process.env.BROKER_DB_PATH ?? resolve(process.cwd(), 'server', 'data', 'broker.sqlite')) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.ensureSchema()
  }

  private ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        handle TEXT NOT NULL,
        display_name TEXT NOT NULL,
        authorization_server TEXT NOT NULL,
        authenticated_at TEXT NOT NULL,
        pds_safety_json TEXT NOT NULL,
        active_persona_id TEXT NOT NULL,
        active_surface_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_status (
        session_id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        availability TEXT NOT NULL,
        compatibility TEXT NOT NULL,
        policy_record TEXT NOT NULL,
        compatibility_record TEXT NOT NULL,
        last_sync_at TEXT NOT NULL,
        supported_claims_json TEXT NOT NULL,
        notes TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS claim_requests (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        app_name TEXT NOT NULL,
        app_kind TEXT NOT NULL,
        surface TEXT NOT NULL,
        requested_claims_json TEXT NOT NULL,
        proof_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        issued_at TEXT,
        last_used_at TEXT,
        expires_at TEXT,
        grant_id TEXT,
        review_note TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS grants (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        app_name TEXT NOT NULL,
        app_kind TEXT NOT NULL,
        surface TEXT NOT NULL,
        requested_claims_json TEXT NOT NULL,
        proof_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        issued_at TEXT,
        last_used_at TEXT,
        expires_at TEXT,
        proof_artifact_ids_json TEXT NOT NULL,
        issuer_id TEXT NOT NULL,
        review_note TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS proof_artifacts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        grant_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        claim_type TEXT NOT NULL,
        requested_value TEXT,
        outcome TEXT NOT NULL,
        statement TEXT NOT NULL,
        proof_mode TEXT NOT NULL,
        issuer_id TEXT NOT NULL,
        verifier_id TEXT NOT NULL,
        audience_app_id TEXT NOT NULL,
        audience_app_name TEXT NOT NULL,
        surface TEXT NOT NULL,
        reference TEXT NOT NULL,
        status TEXT NOT NULL,
        issued_at TEXT NOT NULL,
        last_used_at TEXT,
        expires_at TEXT,
        revoked_at TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS consent_ledger (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        action TEXT NOT NULL,
        subject TEXT NOT NULL,
        detail TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS identity_requests (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        nonce TEXT NOT NULL UNIQUE,
        audience_app_id TEXT NOT NULL,
        audience_app_name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        merchant_identifier TEXT NOT NULL,
        requested_elements_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );
    `)
  }

  private run(sql: string, params: Record<string, SQLInputValue> = {}) {
    return this.db.prepare(sql).run(params)
  }

  private get<T>(sql: string, params: Record<string, SQLInputValue> = {}) {
    return this.db.prepare(sql).get(params) as T | undefined
  }

  private all<T>(sql: string, params: Record<string, SQLInputValue> = {}) {
    return this.db.prepare(sql).all(params) as T[]
  }

  private withTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private mapIdentityRequest(row: IdentityRequestRow): M8IdentityRequest {
    return {
      id: row.id,
      sessionId: row.session_id,
      nonce: row.nonce,
      audienceAppId: row.audience_app_id,
      audienceAppName: row.audience_app_name,
      purpose: row.purpose,
      merchantIdentifier: row.merchant_identifier,
      requestedElements: JSON.parse(row.requested_elements_json) as M8IdentityRequest['requestedElements'],
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
    }
  }

  private loadIdentityRequest(sessionId: string, requestId: string): M8IdentityRequest {
    const row = this.get<IdentityRequestRow>(
      `
        SELECT *
        FROM identity_requests
        WHERE session_id = $sessionId AND id = $requestId
      `,
      { sessionId, requestId }
    )

    if (!row) {
      throw new Error('Identity request not found')
    }

    return this.mapIdentityRequest(row)
  }

  private persistIdentityRequest(request: M8IdentityRequest) {
    this.run(
      `
        INSERT INTO identity_requests (
          id, session_id, nonce, audience_app_id, audience_app_name, purpose,
          merchant_identifier, requested_elements_json, status, created_at, expires_at, used_at
        ) VALUES (
          $id, $sessionId, $nonce, $audienceAppId, $audienceAppName, $purpose,
          $merchantIdentifier, $requestedElementsJson, $status, $createdAt, $expiresAt, $usedAt
        )
      `,
      {
        id: request.id,
        sessionId: request.sessionId,
        nonce: request.nonce,
        audienceAppId: request.audienceAppId,
        audienceAppName: request.audienceAppName,
        purpose: request.purpose,
        merchantIdentifier: request.merchantIdentifier,
        requestedElementsJson: serializeJson(request.requestedElements),
        status: request.status,
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
        usedAt: request.usedAt,
      }
    )
  }

  private persistProviderStatus(sessionId: string, status: ProofBrokerParaProviderStatus) {
    this.run(
      `
        INSERT INTO provider_status (
          session_id, provider_id, display_name, availability, compatibility,
          policy_record, compatibility_record, last_sync_at, supported_claims_json, notes
        ) VALUES (
          $sessionId, $providerId, $displayName, $availability, $compatibility,
          $policyRecord, $compatibilityRecord, $lastSyncAt, $supportedClaimsJson, $notes
        )
        ON CONFLICT(session_id) DO UPDATE SET
          provider_id = excluded.provider_id,
          display_name = excluded.display_name,
          availability = excluded.availability,
          compatibility = excluded.compatibility,
          policy_record = excluded.policy_record,
          compatibility_record = excluded.compatibility_record,
          last_sync_at = excluded.last_sync_at,
          supported_claims_json = excluded.supported_claims_json,
          notes = excluded.notes
      `,
      {
        sessionId,
        providerId: status.providerId,
        displayName: status.displayName,
        availability: status.availability,
        compatibility: status.compatibility,
        policyRecord: status.policyRecord,
        compatibilityRecord: status.compatibilityRecord,
        lastSyncAt: status.lastSyncAt,
        supportedClaimsJson: serializeJson(status.supportedClaims),
        notes: status.notes,
      }
    )
  }

  private loadProviderStatus(sessionId: string) {
    const row = this.get<ProviderStatusRow>(
      'SELECT * FROM provider_status WHERE session_id = $sessionId',
      { sessionId }
    )

    if (!row) {
      throw new Error('Provider status not found')
    }

    return {
      providerId: row.provider_id,
      displayName: row.display_name,
      availability: row.availability,
      compatibility: row.compatibility,
      policyRecord: row.policy_record,
      compatibilityRecord: row.compatibility_record,
      lastSyncAt: row.last_sync_at,
      supportedClaims: parseJson<ProofBrokerClaimType[]>(row.supported_claims_json),
      notes: row.notes,
    } as ProofBrokerParaProviderStatus
  }

  private appendLedger(sessionId: string, action: string, subject: string, detail: string) {
    this.run(
      `
        INSERT INTO consent_ledger (id, session_id, action, subject, detail, timestamp)
        VALUES ($id, $sessionId, $action, $subject, $detail, $timestamp)
      `,
      {
        id: randomUUID(),
        sessionId,
        action,
        subject,
        detail,
        timestamp: nowIso(),
      }
    )
  }

  private updateSessionTimestamp(sessionId: string) {
    this.run(
      'UPDATE sessions SET updated_at = $updatedAt WHERE session_id = $sessionId',
      { sessionId, updatedAt: nowIso() }
    )
  }

  private loadSessionRow(sessionId: string) {
    const row = this.get<SessionRow>(
      'SELECT * FROM sessions WHERE session_id = $sessionId',
      { sessionId }
    )
    if (!row) throw new Error('Session not found')
    return row
  }

  private loadClaimRequests(sessionId: string) {
    const rows = this.all<ClaimRequestRow>(
      'SELECT * FROM claim_requests WHERE session_id = $sessionId ORDER BY requested_at DESC',
      { sessionId }
    )

    return rows.map((row) => ({
      id: row.id,
      appId: row.app_id,
      appName: row.app_name,
      appKind: row.app_kind as ProofBrokerAppKind,
      surface: row.surface,
      requestedClaims: parseJson<ProofBrokerClaimSpec[]>(row.requested_claims_json),
      proofMode: row.proof_mode,
      status: row.status,
      reason: row.reason,
      requestedAt: row.requested_at,
      issuedAt: row.issued_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      grantId: row.grant_id,
    })) satisfies ProofBrokerClaimRequest[]
  }

  private loadGrants(sessionId: string) {
    const rows = this.all<GrantRow>(
      'SELECT * FROM grants WHERE session_id = $sessionId ORDER BY requested_at DESC',
      { sessionId }
    )

    return rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      appId: row.app_id,
      appName: row.app_name,
      appKind: row.app_kind as ProofBrokerAppKind,
      surface: row.surface,
      requestedClaims: parseJson<ProofBrokerClaimSpec[]>(row.requested_claims_json),
      proofMode: row.proof_mode,
      status: row.status,
      reason: row.reason,
      requestedAt: row.requested_at,
      issuedAt: row.issued_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      proofArtifactIds: parseJson<string[]>(row.proof_artifact_ids_json),
      issuerId: row.issuer_id,
      reviewNote: row.review_note,
    })) satisfies ProofBrokerGrant[]
  }

  private loadProofArtifacts(sessionId: string) {
    const rows = this.all<ProofArtifactRow>(
      'SELECT * FROM proof_artifacts WHERE session_id = $sessionId ORDER BY issued_at DESC',
      { sessionId }
    )

    return rows.map((row) => ({
      id: row.id,
      grantId: row.grant_id,
      requestId: row.request_id,
      claimType: row.claim_type as ProofBrokerClaimType,
      requestedValue: row.requested_value,
      outcome: row.outcome,
      statement: row.statement,
      proofMode: row.proof_mode,
      issuerId: row.issuer_id,
      verifierId: row.verifier_id,
      audienceAppId: row.audience_app_id,
      audienceAppName: row.audience_app_name,
      surface: row.surface,
      reference: row.reference,
      status: row.status,
      issuedAt: row.issued_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    })) satisfies ProofBrokerProofArtifact[]
  }

  private loadLedger(sessionId: string) {
    return this.all<LedgerRow>(
      'SELECT * FROM consent_ledger WHERE session_id = $sessionId ORDER BY timestamp DESC',
      { sessionId }
    ).map((row) => ({
      id: row.id,
      action: row.action,
      subject: row.subject,
      detail: row.detail,
      timestamp: row.timestamp,
    }))
  }

  private reconcileExpirations(sessionId: string) {
    const now = nowIso()
    this.run(
      `
        UPDATE grants
        SET status = 'expired'
        WHERE session_id = $sessionId
          AND status = 'approved'
          AND expires_at IS NOT NULL
          AND expires_at < $now
      `,
      { sessionId, now }
    )
    this.run(
      `
        UPDATE proof_artifacts
        SET status = 'expired'
        WHERE session_id = $sessionId
          AND status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < $now
      `,
      { sessionId, now }
    )
  }

  private hydrateSession(sessionId: string): ProofBrokerSession {
    this.reconcileExpirations(sessionId)
    const row = this.loadSessionRow(sessionId)
    const paraStatus = this.loadProviderStatus(sessionId)

    return {
      sessionId: row.session_id,
      brokerMode: 'local',
      did: row.did,
      handle: row.handle,
      displayName: row.display_name,
      authorizationServer: row.authorization_server,
      authenticatedAt: row.authenticated_at,
      pdsSafety: parseJson<ProofBrokerSafetySnapshot>(row.pds_safety_json),
      personas: buildPersonas(row.handle),
      surfaces: buildSurfaces(),
      claimRequests: this.loadClaimRequests(sessionId),
      grants: this.loadGrants(sessionId),
      proofs: this.loadProofArtifacts(sessionId),
      paraStatus,
      activePersonaId: row.active_persona_id,
      activeSurfaceId: row.active_surface_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private insertClaimRequest(sessionId: string, request: ProofBrokerClaimRequest) {
    this.run(
      `
        INSERT INTO claim_requests (
          id, session_id, app_id, app_name, app_kind, surface,
          requested_claims_json, proof_mode, status, reason, requested_at,
          issued_at, last_used_at, expires_at, grant_id, review_note
        ) VALUES (
          $id, $sessionId, $appId, $appName, $appKind, $surface,
          $requestedClaimsJson, $proofMode, $status, $reason, $requestedAt,
          $issuedAt, $lastUsedAt, $expiresAt, $grantId, $reviewNote
        )
      `,
      {
        id: request.id,
        sessionId,
        appId: request.appId,
        appName: request.appName,
        appKind: request.appKind,
        surface: request.surface,
        requestedClaimsJson: serializeJson(request.requestedClaims),
        proofMode: request.proofMode,
        status: request.status,
        reason: request.reason,
        requestedAt: request.requestedAt,
        issuedAt: request.issuedAt,
        lastUsedAt: request.lastUsedAt,
        expiresAt: request.expiresAt,
        grantId: request.grantId,
        reviewNote: null,
      }
    )
  }

  private seedDefaultRequests(sessionId: string) {
    const now = nowIso()
    const defaultRequests: ProofBrokerClaimRequest[] = [
      {
        id: `request-${randomUUID()}`,
        appId: 'townhall-civic',
        appName: 'Townhall Civic',
        appKind: 'Civic app',
        surface: 'civic',
        requestedClaims: [
          { type: 'is_civic_eligible', disclosure: 'proof-only' },
          { type: 'has_para_verification', disclosure: 'proof-only' },
        ],
        proofMode: 'proof-only',
        status: 'pending',
        reason: 'Public-interest discussions want eligibility and verifier status without exposing raw records.',
        requestedAt: now,
        issuedAt: null,
        lastUsedAt: null,
        expiresAt: daysFromNow(14),
        grantId: null,
      },
      {
        id: `request-${randomUUID()}`,
        appId: 'public-figure-feed',
        appName: 'Public Figure Feed',
        appKind: 'Consumer app',
        surface: 'civic',
        requestedClaims: [{ type: 'is_verified_public_figure', disclosure: 'proof-only' }],
        proofMode: 'proof-only',
        status: 'pending',
        reason: 'This feed needs badge-safe public-figure status without pulling review materials.',
        requestedAt: now,
        issuedAt: null,
        lastUsedAt: null,
        expiresAt: daysFromNow(30),
        grantId: null,
      },
    ]

    for (const request of defaultRequests) {
      this.insertClaimRequest(sessionId, request)
    }
  }

  private buildLocalProof(params: {
    sessionId: string
    requestId: string
    grantId: string
    claimType: ProofBrokerClaimType
    appId: string
    appName: string
    surface: ProofBrokerSurfaceId
    statement: string
    reference: string
    expiresAt: string | null
  }): ProofBrokerProofArtifact {
    const issuedAt = nowIso()
    return {
      id: `proof-${randomUUID()}`,
      grantId: params.grantId,
      requestId: params.requestId,
      claimType: params.claimType,
      requestedValue: null,
      outcome: 'verified',
      statement: params.statement,
      proofMode: 'proof-only',
      issuerId: 'm8.broker',
      verifierId: 'm8.broker',
      audienceAppId: params.appId,
      audienceAppName: params.appName,
      surface: params.surface,
      reference: params.reference,
      status: 'active',
      issuedAt,
      lastUsedAt: null,
      expiresAt: params.expiresAt,
      revokedAt: null,
    }
  }

  private async verifyClaim(
    session: ProofBrokerSession,
    request: ProofBrokerClaimRequest,
    claim: ProofBrokerClaimSpec,
    grantId: string,
    expiresAt: string | null
  ): Promise<ProofCheckResult> {
    if (PARA_CLAIMS.includes(claim.type)) {
      const result = await verifyParaClaimFromSeed({
        subject: session.handle,
        claimType: claim.type,
        requestedValue: claim.requestedValue,
        audienceAppId: request.appId,
        audienceAppName: request.appName,
        reason: request.reason,
      })

      if (result.disposition === 'verified' || result.disposition === 'bounded') {
        return {
          status: 'confirmed',
          proof: {
            id: `proof-${randomUUID()}`,
            grantId,
            requestId: request.id,
            claimType: claim.type,
            requestedValue: result.requestedValue,
            outcome: result.outcome ?? 'verified',
            statement: result.statement,
            proofMode: 'proof-only',
            issuerId: 'para.identity',
            verifierId: 'm8.broker',
            audienceAppId: request.appId,
            audienceAppName: request.appName,
            surface: request.surface,
            reference: result.reference ?? `para://${session.handle}/${claim.type}`,
            status: 'active',
            issuedAt: result.evaluatedAt,
            lastUsedAt: null,
            expiresAt,
            revokedAt: null,
          },
        }
      }

      return {
        status: 'review-needed',
        reason: result.notes,
      }
    }

    if (claim.type === 'is_age_eligible') {
      return {
        status: 'confirmed',
        proof: this.buildLocalProof({
          sessionId: session.sessionId,
          requestId: request.id,
          grantId,
          claimType: claim.type,
          appId: request.appId,
          appName: request.appName,
          surface: request.surface,
          statement: 'The broker can satisfy the age gate without exposing date-of-birth data.',
          reference: `m8://${session.handle}/age-eligible`,
          expiresAt,
        }),
      }
    }

    if (claim.type === 'has_backup_coverage') {
      if (session.pdsSafety.state !== 'Backed up') {
        return {
          status: 'review-needed',
          reason: 'Backup coverage is not strong enough to issue a proof right now.',
        }
      }

      return {
        status: 'confirmed',
        proof: this.buildLocalProof({
          sessionId: session.sessionId,
          requestId: request.id,
          grantId,
          claimType: claim.type,
          appId: request.appId,
          appName: request.appName,
          surface: request.surface,
          statement: 'PDS MOOver confirms portable recovery coverage is active for this identity.',
          reference: `pdsmoover://${session.handle}/backup-coverage`,
          expiresAt,
        }),
      }
    }

    return {
      status: 'review-needed',
      reason: `The broker cannot issue ${claim.type} from the current provider set.`,
    }
  }

  async startSession(input: ProofBrokerSessionStartInput): Promise<ProofBrokerSessionStartResponse> {
    const normalized = normalizeIdentifier(input.identifier)
    const sessionId = randomUUID()
    const now = nowIso()
    const safety = buildSafetySnapshot(normalized.handle)
    this.withTransaction(() => {
      this.run(
        `
          INSERT INTO sessions (
            session_id, did, handle, display_name, authorization_server,
            authenticated_at, pds_safety_json, active_persona_id, active_surface_id,
            created_at, updated_at
          ) VALUES (
            $sessionId, $did, $handle, $displayName, $authorizationServer,
            $authenticatedAt, $pdsSafetyJson, $activePersonaId, $activeSurfaceId,
            $createdAt, $updatedAt
          )
        `,
        {
          sessionId,
          did: normalized.did,
          handle: normalized.handle,
          displayName: normalizeDisplayName(normalized.handle),
          authorizationServer: normalized.authorizationServer,
          authenticatedAt: now,
          pdsSafetyJson: serializeJson(safety),
          activePersonaId: 'orbit',
          activeSurfaceId: 'public',
          createdAt: now,
          updatedAt: now,
        }
      )
    })

    const status = await resolveParaProviderStatus()

    return this.withTransaction(() => {
      this.persistProviderStatus(sessionId, status)
      this.seedDefaultRequests(sessionId)
      this.appendLedger(
        sessionId,
        'Verified',
        'm8 broker',
        'Session opened and PARA status was loaded from the civic seed manifest.'
      )
      this.updateSessionTimestamp(sessionId)

      return {
        attempt: {
          sessionId,
          did: normalized.did,
          handle: normalized.handle,
          authorizationServer: normalized.authorizationServer,
          authUrl: `${normalized.authorizationServer}/authorize?client_id=m8-console&session_id=${sessionId}`,
          phaseLabel: 'Broker resolved identity, loaded PARA status, and staged proof-only grants.',
          startedAt: now,
          resolvedAt: now,
        },
        session: this.hydrateSession(sessionId),
      }
    })
  }

  getSession(sessionId: string) {
    this.updateSessionTimestamp(sessionId)
    return this.hydrateSession(sessionId)
  }

  getLedger(sessionId: string) {
    this.loadSessionRow(sessionId)
    return this.loadLedger(sessionId)
  }

  createIdentityDocumentRequest(sessionId: string, input: M8IdentityRequestInput) {
    this.loadSessionRow(sessionId)
    const request = createIdentityRequest(sessionId, input)

    this.withTransaction(() => {
      this.persistIdentityRequest(request)
      this.appendLedger(
        sessionId,
        'Requested',
        request.audienceAppName,
        `Requested ${request.requestedElements.length} wallet identity element(s) with nonce-bound consent.`
      )
      this.updateSessionTimestamp(sessionId)
    })

    return request
  }

  createDemoIdentityPresentation(
    sessionId: string,
    requestId: string,
    selectedElementIds?: M8IdentityRequest['requestedElements'][number]['id'][]
  ) {
    const session = this.hydrateSession(sessionId)
    const request = this.loadIdentityRequest(sessionId, requestId)
    return createDemoWalletPresentation({
      request,
      subjectDid: session.did,
      selectedElementIds,
    })
  }

  verifyIdentityPresentation(
    sessionId: string,
    requestId: string,
    presentation: M8WalletPresentation
  ): M8IdentityVerificationResult {
    this.loadSessionRow(sessionId)
    const request = this.loadIdentityRequest(sessionId, requestId)
    const result = verifyWalletPresentation(request, presentation)

    if (!result.valid) {
      this.withTransaction(() => {
        this.appendLedger(
          sessionId,
          'Rejected',
          request.audienceAppName,
          `Wallet presentation rejected: ${result.errors[0] ?? 'verification failed'}.`
        )
        this.updateSessionTimestamp(sessionId)
      })
      return result
    }

    this.withTransaction(() => {
      this.run(
        `
          UPDATE identity_requests
          SET status = 'used', used_at = $usedAt
          WHERE session_id = $sessionId AND id = $requestId
        `,
        {
          sessionId,
          requestId,
          usedAt: result.checkedAt,
        }
      )
      this.appendLedger(
        sessionId,
        'Verified',
        request.audienceAppName,
        `Wallet presentation verified ${Object.keys(result.disclosedClaims).length} disclosed claim(s).`
      )
      this.updateSessionTimestamp(sessionId)
    })

    return result
  }

  requestGrant(sessionId: string, input: ProofBrokerGrantRequestInput) {
    if (input.proofMode !== 'proof-only') {
      throw new Error('Only proof-only disclosure is supported')
    }
    if (input.requestedClaims.length === 0) {
      throw new Error('At least one claim must be requested')
    }

    const now = nowIso()
    const request: ProofBrokerClaimRequest = {
      id: `request-${randomUUID()}`,
      appId: input.appId,
      appName: input.appName,
      appKind: input.appKind,
      surface: input.surface,
      requestedClaims: input.requestedClaims,
      proofMode: input.proofMode,
      status: 'pending',
      reason: input.reason,
      requestedAt: now,
      issuedAt: null,
      lastUsedAt: null,
      expiresAt: parseExpiry(input.expiresAt ?? null),
      grantId: null,
    }

    this.withTransaction(() => {
      this.insertClaimRequest(sessionId, request)
      this.appendLedger(
        sessionId,
        'Requested',
        request.appName,
        `Requested ${request.requestedClaims.length} proof-safe claim(s) on the ${request.surface} surface.`
      )
      this.updateSessionTimestamp(sessionId)
    })

    return request
  }

  previewClaimRequest(sessionId: string, requestId: string) {
    const session = this.hydrateSession(sessionId)
    const request = session.claimRequests.find((entry) => entry.id === requestId)
    if (!request) {
      throw new Error('Grant request not found')
    }

    const grantId = `preview-${request.id}`
    return Promise.all(
      request.requestedClaims.map(async (claim) => {
        const result = await this.verifyClaim(session, request, claim, grantId, request.expiresAt)
        return result.status === 'confirmed'
          ? {
              artifact: {
                id: result.proof.id,
                claimType: result.proof.claimType,
                issuer: result.proof.issuerId,
                verifier: result.proof.verifierId,
                audienceAppId: result.proof.audienceAppId,
                proofRef: result.proof.reference,
                summary: result.proof.statement,
                issuedAt: result.proof.issuedAt,
                expiresAt: result.proof.expiresAt ?? 'No expiry',
                status: result.proof.status === 'active' ? 'Active' : 'Expired',
              },
              detail: result.proof.statement,
            }
          : {
              artifact: {
                id: `preview-${randomUUID()}`,
                claimType: claim.type,
                issuer: 'm8 broker',
                verifier: 'm8 broker',
                audienceAppId: request.appId,
                proofRef: 'review-needed',
                summary: result.reason,
                issuedAt: nowIso(),
                expiresAt: 'Pending review',
                status: 'Expired',
              },
              detail: result.reason,
            }
      })
    )
  }

  async approveGrant(
    sessionId: string,
    requestId: string,
    input: Partial<ProofBrokerGrantApproveInput> = {}
  ): Promise<ProofBrokerGrantMutationResult> {
    const session = this.hydrateSession(sessionId)
    const request = session.claimRequests.find((entry) => entry.id === requestId)
    if (!request) {
      throw new Error('Grant request not found')
    }

    const expiresAt = parseExpiry(input.expiresAt ?? request.expiresAt)
    const grantId = `grant-${request.id}`
    const proofs: ProofBrokerProofArtifact[] = []
    const reviewNotes: string[] = []

    for (const claim of request.requestedClaims) {
      const result = await this.verifyClaim(session, request, claim, grantId, expiresAt)
      if (result.status === 'confirmed') {
        proofs.push(result.proof)
      } else {
        reviewNotes.push(result.reason)
      }
    }

    if (proofs.length !== request.requestedClaims.length) {
      const detail = reviewNotes[0] ?? 'The broker could not confirm all requested claims'
      throw new Error(`The broker could not confirm all requested claims: ${detail}`)
    }

    const now = nowIso()
    const grant: ProofBrokerGrant = {
      id: grantId,
      requestId: request.id,
      appId: request.appId,
      appName: request.appName,
      appKind: request.appKind,
      surface: request.surface,
      requestedClaims: request.requestedClaims,
      proofMode: request.proofMode,
      status: 'approved',
      reason: request.reason,
      requestedAt: request.requestedAt,
      issuedAt: now,
      lastUsedAt: null,
      expiresAt,
      proofArtifactIds: proofs.map((proof) => proof.id),
      issuerId: proofs.some((proof) => proof.issuerId === 'para.identity') ? 'para.identity' : 'm8.broker',
      reviewNote: input.reviewNote ?? null,
    }

    this.withTransaction(() => {
      this.run(
        `
          UPDATE claim_requests
          SET status = 'approved',
              issued_at = $issuedAt,
              expires_at = $expiresAt,
              grant_id = $grantId,
              review_note = $reviewNote
          WHERE session_id = $sessionId AND id = $requestId
        `,
        {
          sessionId,
          requestId: request.id,
          issuedAt: now,
          expiresAt,
          grantId: grant.id,
          reviewNote: grant.reviewNote,
        }
      )

      this.run(
        `
          INSERT INTO grants (
            id, session_id, request_id, app_id, app_name, app_kind, surface,
            requested_claims_json, proof_mode, status, reason, requested_at,
            issued_at, last_used_at, expires_at, proof_artifact_ids_json, issuer_id, review_note
          ) VALUES (
            $id, $sessionId, $requestId, $appId, $appName, $appKind, $surface,
            $requestedClaimsJson, $proofMode, $status, $reason, $requestedAt,
            $issuedAt, $lastUsedAt, $expiresAt, $proofArtifactIdsJson, $issuerId, $reviewNote
          )
        `,
        {
          id: grant.id,
          sessionId,
          requestId: grant.requestId,
          appId: grant.appId,
          appName: grant.appName,
          appKind: grant.appKind,
          surface: grant.surface,
          requestedClaimsJson: serializeJson(grant.requestedClaims),
          proofMode: grant.proofMode,
          status: grant.status,
          reason: grant.reason,
          requestedAt: grant.requestedAt,
          issuedAt: grant.issuedAt,
          lastUsedAt: grant.lastUsedAt,
          expiresAt: grant.expiresAt,
          proofArtifactIdsJson: serializeJson(grant.proofArtifactIds),
          issuerId: grant.issuerId,
          reviewNote: grant.reviewNote,
        }
      )

      for (const proof of proofs) {
        this.run(
          `
            INSERT INTO proof_artifacts (
              id, session_id, grant_id, request_id, claim_type, requested_value,
              outcome, statement, proof_mode, issuer_id, verifier_id, audience_app_id,
              audience_app_name, surface, reference, status, issued_at, last_used_at,
              expires_at, revoked_at
            ) VALUES (
              $id, $sessionId, $grantId, $requestId, $claimType, $requestedValue,
              $outcome, $statement, $proofMode, $issuerId, $verifierId, $audienceAppId,
              $audienceAppName, $surface, $reference, $status, $issuedAt, $lastUsedAt,
              $expiresAt, $revokedAt
            )
          `,
          {
            id: proof.id,
            sessionId,
            grantId: proof.grantId,
            requestId: proof.requestId,
            claimType: proof.claimType,
            requestedValue: proof.requestedValue,
            outcome: proof.outcome,
            statement: proof.statement,
            proofMode: proof.proofMode,
            issuerId: proof.issuerId,
            verifierId: proof.verifierId,
            audienceAppId: proof.audienceAppId,
            audienceAppName: proof.audienceAppName,
            surface: proof.surface,
            reference: proof.reference,
            status: proof.status,
            issuedAt: proof.issuedAt,
            lastUsedAt: proof.lastUsedAt,
            expiresAt: proof.expiresAt,
            revokedAt: proof.revokedAt,
          }
        )
      }

      this.appendLedger(
        sessionId,
        'Approved',
        request.appName,
        `Approved proof-only grant for ${request.requestedClaims.map((claim) => claim.type).join(', ')}.`
      )
      this.updateSessionTimestamp(sessionId)
    })

    return {
      session: this.getSession(sessionId),
      grant,
      proofs,
    }
  }

  revokeGrant(
    sessionId: string,
    grantId: string,
    input: Partial<ProofBrokerGrantRevokeInput> = {}
  ): ProofBrokerGrantMutationResult {
    const grant = this.loadGrants(sessionId).find((entry) => entry.id === grantId)
    if (!grant) {
      throw new Error('Grant not found')
    }

    const now = nowIso()
    this.withTransaction(() => {
      this.run(
        `
          UPDATE grants
          SET status = 'revoked', last_used_at = $lastUsedAt, review_note = $reviewNote
          WHERE session_id = $sessionId AND id = $grantId
        `,
        {
          sessionId,
          grantId,
          lastUsedAt: now,
          reviewNote: input.reason ?? 'Revoked by the user.',
        }
      )
      this.run(
        `
          UPDATE claim_requests
          SET status = 'revoked', last_used_at = $lastUsedAt, review_note = $reviewNote
          WHERE session_id = $sessionId AND grant_id = $grantId
        `,
        {
          sessionId,
          grantId,
          lastUsedAt: now,
          reviewNote: input.reason ?? 'Revoked by the user.',
        }
      )
      this.run(
        `
          UPDATE proof_artifacts
          SET status = 'revoked', revoked_at = $revokedAt, last_used_at = $lastUsedAt
          WHERE session_id = $sessionId AND grant_id = $grantId
        `,
        {
          sessionId,
          grantId,
          revokedAt: now,
          lastUsedAt: now,
        }
      )
      this.appendLedger(
        sessionId,
        'Revoked',
        grant.appName,
        input.reason ?? 'Revoked the grant and invalidated any linked proof artifacts for future sessions.'
      )
      this.updateSessionTimestamp(sessionId)
    })

    const updatedGrant = this.loadGrants(sessionId).find((entry) => entry.id === grantId)
    if (!updatedGrant) {
      throw new Error('Grant not found after revocation')
    }

    return {
      session: this.getSession(sessionId),
      grant: updatedGrant,
      proofs: this.loadProofArtifacts(sessionId).filter((proof) => proof.grantId === grantId),
    }
  }

  async getParaStatus(sessionId: string) {
    const session = this.loadSessionRow(sessionId)
    const status = await resolveParaProviderStatus()
    this.persistProviderStatus(sessionId, status)
    this.updateSessionTimestamp(sessionId)
    return this.loadProviderStatus(session.session_id)
  }
}
