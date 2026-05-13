import {
  type ClaimDescriptor,
  type ClaimRequest,
  type ClaimType,
  type ConsentLedgerEntry,
  type ConsentPolicy,
  type PdsSafetyPolicy,
  type PdsSafetySnapshot,
  type ProofArtifact,
  type ProofLifecycleCopy,
  type GrantProofMode,
} from './types'

const CLAIM_CATALOG: ClaimDescriptor[] = [
  {
    type: 'is_verified_public_figure',
    label: 'Verified public figure',
    learns: 'Signals that PARA approved the account for public-figure treatment.',
  },
  {
    type: 'is_civic_eligible',
    label: 'Civic eligible',
    learns: 'Confirms civic eligibility without exposing the source record.',
  },
  {
    type: 'has_para_verification',
    label: 'PARA verification',
    learns: 'Shows that PARA has issued a compatibility-safe verification outcome.',
  },
  {
    type: 'is_age_eligible',
    label: 'Age eligible',
    learns: 'Confirms age eligibility without sharing the identity document.',
  },
  {
    type: 'has_party_affiliation_match',
    label: 'Affiliation match',
    learns: 'Returns a bounded yes/no result instead of the full values payload.',
  },
]

const CONSENT_POLICY: ConsentPolicy = {
  title: 'Consent ledger rules',
  summary:
    'Apps request claims, not full profiles. Proof-only is the default for civic and political data, and every grant must stay revocable.',
  rules: [
    {
      title: 'Minimum disclosure',
      detail:
        'Each grant is scoped to a surface and a short claim list. Raw identity data stays behind the broker.',
      effect: 'Default',
    },
    {
      title: 'Proof-only by default',
      detail:
        'Civic, political, and identity-affiliation requests resolve to proof-only grants unless the user explicitly widens the share mode later.',
      effect: 'Guardrail',
    },
    {
      title: 'User revocation wins',
      detail:
        'A revoked grant blocks future proof issuance and stops refreshes for the affected app.',
      effect: 'Stop',
    },
    {
      title: 'Expiry is expected',
      detail:
        'Long-lived access is unusual. Most proof grants should expire and require a fresh review.',
      effect: 'Audit',
    },
  ],
}

const PROOF_LIFECYCLE: ProofLifecycleCopy = {
  title: 'Proof lifecycle',
  summary:
    'The app can show where a proof lives, when it expires, and how it can be revoked without leaking the raw identity record.',
  steps: [
    {
      id: 'request',
      title: 'Request a claim',
      detail: 'The app asks for a bounded statement, not the whole profile.',
      action: 'Review claim scope',
    },
    {
      id: 'review',
      title: 'Review the disclosure',
      detail: 'The broker explains what the app will learn and what stays private.',
      action: 'Check audience',
    },
    {
      id: 'approve',
      title: 'Approve the grant',
      detail: 'Consent is recorded with a surface, an audience, and an expiry.',
      action: 'Approve or deny',
    },
    {
      id: 'issue',
      title: 'Issue the proof',
      detail: 'The app receives a proof reference or a verified result, not the raw record.',
      action: 'Attach proof',
    },
    {
      id: 'refresh',
      title: 'Refresh or expire',
      detail: 'Proofs can age out and be renewed before the next access window.',
      action: 'Renew access',
    },
    {
      id: 'revoke',
      title: 'Revoke access',
      detail: 'Revocation immediately blocks future proofs for new sessions.',
      action: 'Revoke now',
    },
  ],
}

const PDS_SAFETY_POLICY: PdsSafetyPolicy = {
  title: 'PDS MOOver safety states',
  summary:
    'PDS safety stays separate from the profile surface. The broker can surface safety posture, migration risk, and proof degradation without exposing more identity data.',
  states: [
    {
      state: 'Backed up',
      summary: 'Backup and migration health are good.',
      proofImpact: 'Proofs can issue normally.',
      action: 'Keep monitoring',
      severity: 'Good',
    },
    {
      state: 'Enroll now',
      summary: 'No backup enrollment has been detected yet.',
      proofImpact: 'Long-lived grants should wait until backup is active.',
      action: 'Start backup',
      severity: 'Warning',
    },
    {
      state: 'Needs attention',
      summary: 'A backup exists, but follow-up work remains.',
      proofImpact: 'Issue proofs carefully and prompt a health review.',
      action: 'Review health',
      severity: 'Warning',
    },
    {
      state: 'Migrating',
      summary: 'The account is preparing for or in the middle of a move.',
      proofImpact: 'Fresh proofs may pause until the move completes.',
      action: 'Hold refreshes',
      severity: 'Warning',
    },
    {
      state: 'Proof degraded',
      summary: 'A verifier or provider is unavailable.',
      proofImpact: 'Fallback to manual review or retry the proof later.',
      action: 'Fallback to review',
      severity: 'Critical',
    },
    {
      state: 'Recovery paused',
      summary: 'Recovery has been intentionally paused by policy.',
      proofImpact: 'Do not issue new long-lived proofs until recovery resumes.',
      action: 'Resume recovery',
      severity: 'Critical',
    },
  ],
}

function handleRoot(handle: string) {
  return handle.startsWith('@') ? handle.slice(1).split('.')[0] : handle.split('.')[0]
}

export function buildClaimCatalog() {
  return CLAIM_CATALOG.map((claim) => ({ ...claim }))
}

export function buildConsentPolicy() {
  return {
    ...CONSENT_POLICY,
    rules: CONSENT_POLICY.rules.map((rule) => ({ ...rule })),
  }
}

export function buildProofLifecycleCopy() {
  return {
    ...PROOF_LIFECYCLE,
    steps: PROOF_LIFECYCLE.steps.map((step) => ({ ...step })),
  }
}

export function buildPdsSafetyPolicy() {
  return {
    ...PDS_SAFETY_POLICY,
    states: PDS_SAFETY_POLICY.states.map((state) => ({ ...state })),
  }
}

export function buildBrokerPhaseLabel() {
  return 'Broker resolved identity, consent policy, and proof handoff'
}

export function buildPdsSafetySnapshot(handle: string): PdsSafetySnapshot {
  const root = handleRoot(handle)

  if (root.includes('move') || root.includes('recover')) {
    return {
      state: 'Needs attention',
      detail: 'Backup exists, but the last repo check found follow-up work.',
      source: 'pdsmoover.network',
      lastBackup: '2 days ago',
    }
  }

  if (root.includes('migrate') || root.includes('transfer')) {
    return {
      state: 'Migrating',
      detail: 'A repo move is in progress and proof refreshes should stay cautious.',
      source: 'pdsmoover.network',
      lastBackup: 'In progress',
    }
  }

  if (root.includes('proof') || root.includes('verify')) {
    return {
      state: 'Proof degraded',
      detail: 'A verifier signal is degraded, so the broker should fall back to manual review.',
      source: 'pdsmoover.network',
      lastBackup: '30 minutes ago',
    }
  }

  if (root.includes('new') || root.includes('fresh')) {
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

export function buildClaimRequests(handle: string): ClaimRequest[] {
  const root = handleRoot(handle)

  return [
    {
      id: 'request-townhall-civic',
      appId: 'townhall-civic',
      appName: 'Townhall Civic',
      appKind: 'Civic app',
      surface: 'civic',
      requestedClaims: ['is_verified_public_figure', 'is_civic_eligible'],
      proofMode: 'proof-only',
      audience: 'Townhall Civic',
      expiresAt: '48 hours',
      status: 'Pending',
      requestedAt: 'Now',
      reason: 'The app only needs proof of eligibility for civic discussions.',
      verifier: 'PARA verifier',
      expiryPreference: '48 hours',
    },
    {
      id: 'request-dating-beta',
      appId: 'dating-beta',
      appName: 'Atmos Dating beta',
      appKind: 'Consumer app',
      surface: 'dating',
      requestedClaims: ['is_age_eligible', 'has_party_affiliation_match'],
      proofMode: 'proof-only',
      audience: 'Dating surface',
      expiresAt: '24 hours',
      status: 'Approved',
      requestedAt: 'Today',
      reason: 'Only a bounded compatibility result should leave the broker.',
      verifier: 'm8 proof broker',
      expiryPreference: '24 hours',
    },
    {
      id: 'request-local-circle',
      appId: 'local-circle',
      appName: `${root} local circle`,
      appKind: 'Community app',
      surface: 'public',
      requestedClaims: ['has_para_verification'],
      proofMode: 'attested',
      audience: 'Public community surface',
      expiresAt: '7 days',
      status: 'Pending',
      requestedAt: 'Yesterday',
      reason: 'Local trust can use attestation without exposing the underlying policy record.',
      verifier: 'm8 proof broker',
      expiryPreference: '7 days',
    },
  ]
}

export function buildConsentLedger(handle: string): ConsentLedgerEntry[] {
  const root = handleRoot(handle)

  return [
    {
      id: 'ledger-request-01',
      action: 'Requested',
      subject: 'Townhall Civic requested proof-only civic eligibility',
      detail: 'A civic app asked for a bounded claim and received the request into the ledger.',
      timestamp: 'Now',
      app: 'Townhall Civic',
      surface: 'civic',
      outcome: 'Approved',
    },
    {
      id: 'ledger-approve-01',
      action: 'Approved',
      subject: 'Atmos Dating beta approved a proof-only grant',
      detail: 'The broker recorded a short-lived proof grant for the dating surface.',
      timestamp: 'Today',
      app: 'Atmos Dating beta',
      surface: 'dating',
      outcome: 'Approved',
    },
    {
      id: 'ledger-verify-01',
      action: 'Verified',
      subject: `${root} local circle verified the public identity slice`,
      detail: 'The grant is limited to a public slice and can be revoked at any time.',
      timestamp: 'Yesterday',
      app: `${root} local circle`,
      surface: 'public',
      outcome: 'Approved',
    },
    {
      id: 'ledger-revoke-01',
      action: 'Revoked',
      subject: 'An old proof flow was revoked',
      detail: 'Revocation blocks future proof refreshes and removes the old path from the ledger.',
      timestamp: 'Last week',
      app: 'Legacy app',
      surface: 'public',
      outcome: 'Revoked',
    },
  ]
}

export function buildProofArtifacts(handle: string): ProofArtifact[] {
  const root = handleRoot(handle)

  return [
    {
      id: 'proof-townhall-civic',
      claimType: 'is_civic_eligible',
      label: 'Civic eligible',
      issuer: 'PARA verifier',
      verifier: 'm8 broker',
      audienceAppId: 'Townhall Civic',
      proofRef: `proof://para/${root}/civic`,
      summary: 'Civic eligibility shared in proof-only mode.',
      issuedAt: 'Now',
      expiresAt: '48 hours',
      status: 'Active',
    },
    {
      id: 'proof-dating-beta',
      claimType: 'has_party_affiliation_match',
      label: 'Party affiliation match',
      issuer: 'm8 proof broker',
      verifier: 'Atmos Dating beta',
      audienceAppId: 'Atmos Dating beta',
      proofRef: `proof://m8/${root}/dating`,
      summary: 'Bounded alignment result shared without the raw values payload.',
      issuedAt: 'Today',
      expiresAt: '24 hours',
      status: 'Active',
    },
    {
      id: 'proof-local-circle',
      claimType: 'has_para_verification',
      label: 'PARA verification',
      issuer: 'm8 proof broker',
      verifier: 'Neighborhood wallet',
      audienceAppId: `${root} local circle`,
      proofRef: `proof://m8/${root}/public`,
      summary: 'Public identity slice shared as a short-lived attestation.',
      issuedAt: 'Yesterday',
      expiresAt: '7 days',
      status: 'Expired',
    },
  ]
}

export function claimLabelFor(type: ClaimType) {
  return CLAIM_CATALOG.find((claim) => claim.type === type)?.label ?? type
}

export function disclosureForMode(mode: GrantProofMode) {
  if (mode === 'proof-only') return 'Proof-only'
  if (mode === 'attested') return 'Attested'
  return 'Compatibility only'
}
