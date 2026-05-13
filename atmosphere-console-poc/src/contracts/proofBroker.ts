export type ProofBrokerSurfaceId = 'public' | 'civic' | 'dating'

export type ProofBrokerDisclosureMode = 'proof-only' | 'signed-claim' | 'raw'

export type ProofBrokerGrantStatus = 'pending' | 'approved' | 'revoked' | 'expired'

export type ProofBrokerProofStatus = 'pending' | 'active' | 'revoked' | 'expired'

export type ProofBrokerClaimType =
  | 'is_verified_public_figure'
  | 'is_civic_eligible'
  | 'has_para_verification'
  | 'has_party_affiliation_match'
  | 'is_age_eligible'
  | 'has_backup_coverage'

export type ProofBrokerAppKind =
  | 'Consumer app'
  | 'Civic app'
  | 'Community app'
  | 'Local app'
  | 'Verifier'
  | 'Broker'

export type ProofBrokerVerifierId = 'para.identity' | 'm8.broker'

export type ProofBrokerPersona = {
  id: string
  name: string
  handle: string
  role: string
  summary: string
  activeSurface: ProofBrokerSurfaceId
  surfaceStates: Record<ProofBrokerSurfaceId, 'Live' | 'Limited' | 'Muted'>
}

export type ProofBrokerSurface = {
  id: ProofBrokerSurfaceId
  label: string
  audience: string
  status: 'Live' | 'Limited' | 'Muted'
  defaultDisclosureMode: ProofBrokerDisclosureMode
}

export type ProofBrokerSafetySnapshot = {
  state: 'Backed up' | 'Enroll now' | 'Needs attention'
  detail: string
  source: string
  lastBackup: string
}

export type ProofBrokerParaProviderStatus = {
  providerId: 'para.identity'
  displayName: string
  availability: 'online' | 'degraded' | 'offline'
  compatibility: 'ready' | 'scoped' | 'needs-review'
  policyRecord: 'com.para.identity'
  compatibilityRecord: 'app.bsky.graph.verification'
  lastSyncAt: string
  supportedClaims: ProofBrokerClaimType[]
  notes: string
}

export type ProofBrokerClaimSpec = {
  type: ProofBrokerClaimType
  disclosure: ProofBrokerDisclosureMode
  requestedValue?: string
}

export type ProofBrokerClaimRequest = {
  id: string
  appId: string
  appName: string
  appKind: ProofBrokerAppKind
  surface: ProofBrokerSurfaceId
  requestedClaims: ProofBrokerClaimSpec[]
  proofMode: ProofBrokerDisclosureMode
  status: ProofBrokerGrantStatus
  reason: string
  requestedAt: string
  issuedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  grantId: string | null
}

export type ProofBrokerGrant = {
  id: string
  requestId: string
  appId: string
  appName: string
  appKind: ProofBrokerAppKind
  surface: ProofBrokerSurfaceId
  requestedClaims: ProofBrokerClaimSpec[]
  proofMode: ProofBrokerDisclosureMode
  status: ProofBrokerGrantStatus
  reason: string
  requestedAt: string
  issuedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  proofArtifactIds: string[]
  issuerId: ProofBrokerVerifierId
  reviewNote: string | null
}

export type ProofBrokerProofOutcome = 'verified' | 'not-verified' | 'matched' | 'mismatched' | 'bounded'

export type ProofBrokerProofArtifact = {
  id: string
  grantId: string
  requestId: string
  claimType: ProofBrokerClaimType
  requestedValue: string | null
  outcome: ProofBrokerProofOutcome
  statement: string
  proofMode: ProofBrokerDisclosureMode
  issuerId: ProofBrokerVerifierId
  verifierId: ProofBrokerVerifierId
  audienceAppId: string
  audienceAppName: string
  surface: ProofBrokerSurfaceId
  reference: string
  status: ProofBrokerProofStatus
  issuedAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
}

export type ProofBrokerSession = {
  sessionId: string
  brokerMode: 'mock' | 'local'
  did: string
  handle: string
  displayName: string
  authorizationServer: string
  authenticatedAt: string
  pdsSafety: ProofBrokerSafetySnapshot
  personas: ProofBrokerPersona[]
  surfaces: ProofBrokerSurface[]
  claimRequests: ProofBrokerClaimRequest[]
  grants: ProofBrokerGrant[]
  proofs: ProofBrokerProofArtifact[]
  paraStatus: ProofBrokerParaProviderStatus
  activePersonaId: string
  activeSurfaceId: ProofBrokerSurfaceId
  createdAt: string
  updatedAt: string
}

export type ProofBrokerSessionStartInput = {
  identifier: string
}

export type ProofBrokerSessionStartAttempt = {
  sessionId: string
  did: string
  handle: string
  authorizationServer: string
  authUrl: string
  phaseLabel: string
  startedAt: string
  resolvedAt: string
}

export type ProofBrokerSessionStartResponse = {
  attempt: ProofBrokerSessionStartAttempt
  session: ProofBrokerSession
}

export type ProofBrokerGrantRequestInput = {
  appId: string
  appName: string
  appKind: ProofBrokerAppKind
  surface: ProofBrokerSurfaceId
  requestedClaims: ProofBrokerClaimSpec[]
  proofMode: ProofBrokerDisclosureMode
  reason: string
  expiresAt?: string | null
  sessionId?: string
}

export type ProofBrokerGrantApproveInput = {
  grantId: string
  reviewNote?: string
  expiresAt?: string | null
  sessionId?: string
}

export type ProofBrokerGrantRevokeInput = {
  grantId: string
  reason?: string
  sessionId?: string
}

export type ProofBrokerClaimVerificationInput = {
  claimType: ProofBrokerClaimType
  requestedValue?: string
  audienceAppId: string
  audienceAppName: string
  surface: ProofBrokerSurfaceId
  proofMode: ProofBrokerDisclosureMode
  verifierId: ProofBrokerVerifierId
  reason: string
  sessionId?: string
}

export type ProofBrokerGrantMutationResult = {
  session: ProofBrokerSession
  grant: ProofBrokerGrant
  proofs: ProofBrokerProofArtifact[]
}

export function proofBrokerClaimLabel(claimType: ProofBrokerClaimType) {
  if (claimType === 'is_verified_public_figure') return 'Verified public figure'
  if (claimType === 'is_civic_eligible') return 'Civic eligible'
  if (claimType === 'has_para_verification') return 'PARA verification'
  if (claimType === 'has_party_affiliation_match') return 'Party affiliation match'
  if (claimType === 'has_backup_coverage') return 'Backup coverage'
  return 'Age eligible'
}

export function proofBrokerClaimSummary(spec: ProofBrokerClaimSpec) {
  const label = proofBrokerClaimLabel(spec.type)

  if (spec.requestedValue) {
    return `${label}: ${spec.requestedValue}`
  }

  return label
}
