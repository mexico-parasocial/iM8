

// ─── Identity Wallet Types ─────────────────────────────────────────────────

export type M8IdentityElementId =
  | 'age_over_18'
  | 'age_over_21'
  | 'citizenship'
  | 'district_hash'
  | 'curp_hash'
  | 'verified_public_figure'

export type M8IdentityStorageIntent =
  | { mode: 'will-not-store' }
  | { mode: 'may-store'; days: number }
  | { mode: 'may-store-until-revoked' }

export type M8IdentityRequestedElement = {
  id: M8IdentityElementId
  intentToStore: M8IdentityStorageIntent
  required: boolean
}

export const M8IdentityRequestInputSchema = z.object({
  audienceAppId: z.string().min(1),
  audienceAppName: z.string().min(1),
  purpose: z.string().min(1),
  merchantIdentifier: z.string().optional(),
  requestedElements: z.array(z.object({
    id: z.enum(['age_over_18', 'age_over_21', 'citizenship', 'district_hash', 'curp_hash', 'verified_public_figure']),
    intentToStore: z.union([
      z.object({ mode: z.literal('will-not-store') }),
      z.object({ mode: z.literal('may-store'), days: z.number().int().positive() }),
      z.object({ mode: z.literal('may-store-until-revoked') }),
    ]),
    required: z.boolean(),
  })).min(1),
  expiresInSeconds: z.number().int().min(30).max(900).optional(),
})

export type M8IdentityRequestInput = z.infer<typeof M8IdentityRequestInputSchema>

export type M8IdentityRequest = {
  id: string
  sessionId: string
  nonce: string
  audienceAppId: string
  audienceAppName: string
  purpose: string
  merchantIdentifier: string
  requestedElements: M8IdentityRequestedElement[]
  status: 'active' | 'used' | 'expired'
  createdAt: string
  expiresAt: string
  usedAt: string | null
}

export type M8IdentityCredentialClaims = Partial<Record<M8IdentityElementId, string | boolean>>

export type M8IdentityCredential = {
  id: string
  issuerDid: string
  issuerKeyId: string
  subjectDid: string
  issuedAt: string
  expiresAt: string
  claims: M8IdentityCredentialClaims
  revocationHash: string
  signatureAlg: 'Ed25519'
  signature: string
}

export type M8WalletPresentation = {
  type: 'm8.identity.presentation.v1'
  requestId: string
  nonce: string
  audienceAppId: string
  credential: M8IdentityCredential
  disclosedClaims: M8IdentityCredentialClaims
  devicePublicKey: string
  issuedAt: string
  expiresAt: string
  signatureAlg: 'Ed25519'
  signature: string
}

export type M8TrustedIssuer = {
  did: string
  keyId: string
  name: string
  country: string
  status: 'active' | 'previous' | 'suspended' | 'revoked' | 'expired'
  notAfter?: string
  publicKeyPem: string
  allowedElements: M8IdentityElementId[]
}

export type M8IdentityVerificationResult = {
  valid: boolean
  requestId: string
  presentationId: string
  issuerDid: string | null
  issuerName: string | null
  subjectDid: string | null
  disclosedClaims: M8IdentityCredentialClaims
  checkedAt: string
  errors: string[]
  warnings: string[]
}

// ─── INE Simulation Types ──────────────────────────────────────────────────

export type IneAddress = {
  street: string
  neighborhood: string
  city: string
  state: string
  postalCode: string
}

export type IneExtractedData = {
  fullName: string
  firstName: string
  lastNamePaternal: string
  lastNameMaternal: string
  curp: string
  voterId: string
  birthDate: string
  gender: 'M' | 'F'
  address: IneAddress
  photoHash: string
  expiryYear: number
}

export type IneVerificationResult = {
  faceMatch: {
    score: number
    threshold: number
    passed: boolean
  }
  renapo: {
    status: 'active' | 'deceased' | 'not-found' | 'duplicate'
    registeredName: string
    registeredCurp: string
    citizenship: 'MX'
    matched: boolean
  }
  overall: 'verified' | 'rejected' | 'manual-review-required'
  verificationId: string
  verifiedAt: string
}

export type IneCredentialInput = {
  extracted: IneExtractedData
  verification: IneVerificationResult
  sessionId: string
  subjectDid: string
}

// ─── Proof Broker Types ────────────────────────────────────────────────────

export type ProofBrokerSurfaceId = 'public' | 'civic' | 'dating'

export type ProofBrokerDisclosureMode = 'proof-only' | 'signed-claim' | 'raw'

export type ProofBrokerGrantStatus = 'pending' | 'approved' | 'suspended' | 'revoked' | 'expired'

export type ProofBrokerProofStatus = 'pending' | 'active' | 'suspended' | 'revoked' | 'expired'

export const PROOF_BROKER_CLAIM_TYPES = [
  'is_verified_public_figure',
  'is_civic_eligible',
  'has_para_verification',
  'has_party_affiliation_match',
  'joined_during_founding_period',
  'has_continuous_party_membership_30d',
  'is_age_eligible',
  'has_backup_coverage',
] as const

export type ProofBrokerClaimType = (typeof PROOF_BROKER_CLAIM_TYPES)[number]

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
  status: 'pending' | 'active' | 'suspended' | 'revoked'
  pdsSafety: ProofBrokerSafetySnapshot
  personas: ProofBrokerPersona[]
  surfaces: ProofBrokerSurface[]
  claimRequests: ProofBrokerClaimRequest[]
  grants: ProofBrokerGrant[]
  proofs: ProofBrokerProofArtifact[]
  paraStatus: ProofBrokerParaProviderStatus
  activePersonaId: string
  activeSurfaceId: ProofBrokerSurfaceId
  oauthScope: string
  createdAt: string
  updatedAt: string
}

export type ProofBrokerSessionStartInput = {
  identifier: string
  surface?: ProofBrokerSurfaceId
}

export type ProofBrokerSessionStartAttempt = {
  sessionId?: string
  attemptId?: string
  did?: string
  handle?: string
  identifier?: string
  authorizationServer?: string
  authUrl: string
  phaseLabel: string
  startedAt: string
  resolvedAt?: string
  expiresAt?: string
}

export type ProofBrokerSessionStartResponse = {
  attempt: ProofBrokerSessionStartAttempt
  session: ProofBrokerSession | null
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
}

export type ProofBrokerGrantApproveInput = {
  grantId: string
  reviewNote?: string
  expiresAt?: string | null
}

export type ProofBrokerGrantRevokeInput = {
  grantId: string
  reason?: string
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
}

export type ProofBrokerGrantMutationResult = {
  session: ProofBrokerSession
  grant: ProofBrokerGrant
  proofs: ProofBrokerProofArtifact[]
}

export function proofBrokerClaimLabel(claimType: ProofBrokerClaimType) {
  const labels: Record<ProofBrokerClaimType, string> = {
    is_verified_public_figure: 'Verified public figure',
    is_civic_eligible: 'Civic eligible',
    has_para_verification: 'PARA verification',
    has_party_affiliation_match: 'Party affiliation match',
    joined_during_founding_period: 'Joined during founding period',
    has_continuous_party_membership_30d: 'Continuous party membership, 30+ days',
    is_age_eligible: 'Age eligible',
    has_backup_coverage: 'Backup coverage',
  }
  return labels[claimType] ?? 'Unknown claim'
}

export function proofBrokerClaimSummary(spec: ProofBrokerClaimSpec) {
  const label = proofBrokerClaimLabel(spec.type)
  return spec.requestedValue ? `${label}: ${spec.requestedValue}` : label
}

export type { ParaRecordType, ParaTrustContractEntry, ParaRevocationState, ParaFailureState } from '../services/paraTrustContract.js'

// ─── Community Governance Types ────────────────────────────────────────────

export type CommunityStatus = 'pending_admins' | 'active' | 'dissolved'

export type CommunityMembershipStatus = 'pending' | 'active' | 'suspended' | 'left'

export type CommunityAdminStatus = 'active' | 'removed'

export type CommunityActionType =
  | 'blog_post'
  | 'ruleset_mod'
  | 'name_change'
  | 'compass_change'
  | 'manifesto_update'
  | 'admin_add'
  | 'admin_remove'

export type CommunityActionImpactLevel = 'low' | 'high'

export type CommunityActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'

export type CommunityActionVote = 'approve' | 'reject'

export type Community = {
  id: string
  did: string
  handle: string | null
  name: string
  description: string
  manifestoCid: string | null
  politicalCompassX: number | null
  politicalCompassY: number | null
  rulesetCid: string | null
  pdsHost: string
  status: CommunityStatus
  createdByDid: string
  bootstrapUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CommunityAdmin = {
  communityId: string
  adminDid: string
  addedByDid: string | null
  addedAt: string
  status: CommunityAdminStatus
}

export type CommunityMembership = {
  communityId: string
  memberDid: string
  status: CommunityMembershipStatus
  membershipRecordUri: string | null
  groupRecordUri: string | null
  joinedAt: string | null
  leftAt: string | null
}

export type CommunityAction = {
  id: string
  communityId: string
  actionType: CommunityActionType
  impactLevel: CommunityActionImpactLevel
  payload: Record<string, unknown>
  proposedByDid: string
  status: CommunityActionStatus
  requiredApprovals: number
  currentApprovals: number
  repoCommitCid: string | null
  createdAt: string
  executedAt: string | null
  failedReason: string | null
}

export type CommunityActionVoteRecord = {
  actionId: string
  adminDid: string
  vote: CommunityActionVote
  voteSignature: string
  signedAt: string | null
  signedPayloadHash: string | null
  verificationMethodId: string | null
  signatureNonce: string | null
  votedAt: string
}

export const COMMUNITY_ACTION_THRESHOLDS: Record<CommunityActionType, { impact: CommunityActionImpactLevel; required: number }> = {
  blog_post: { impact: 'low', required: 2 },
  ruleset_mod: { impact: 'low', required: 2 },
  name_change: { impact: 'high', required: 3 },
  compass_change: { impact: 'high', required: 3 },
  manifesto_update: { impact: 'high', required: 3 },
  admin_add: { impact: 'high', required: 3 },
  admin_remove: { impact: 'high', required: 3 },
}

export const MIN_COMMUNITY_ADMINS = 3

export const CreateCommunityInputSchema = z.object({
  did: z.string().min(1),
  handle: z.string().min(1).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  pdsHost: z.string().min(1).optional(),
}).strict()

export type CreateCommunityInput = z.infer<typeof CreateCommunityInputSchema>

export const ProposeActionInputSchema = z.object({
  actionType: z.enum(['blog_post', 'ruleset_mod', 'name_change', 'compass_change', 'manifesto_update', 'admin_add', 'admin_remove']),
  payload: z.record(z.unknown()),
}).strict()

export type ProposeActionInput = z.infer<typeof ProposeActionInputSchema>

export const VoteActionInputSchema = z.object({
  vote: z.enum(['approve', 'reject']),
  signature: z.string().min(1),
  signedAt: z.string().datetime(),
  nonce: z.string().min(16).max(256),
  keyId: z.string().min(1).max(512).optional(),
}).strict()

export type VoteActionInput = z.infer<typeof VoteActionInputSchema>

export const AddAdminInputSchema = z.object({
  adminDid: z.string().min(1),
}).strict()

export type AddAdminInput = z.infer<typeof AddAdminInputSchema>

export const BootstrapAdminsInputSchema = z.object({
  adminDids: z.array(z.string().min(1)).min(1).max(20),
}).strict()

export type BootstrapAdminsInput = z.infer<typeof BootstrapAdminsInputSchema>

import { z } from 'zod'
