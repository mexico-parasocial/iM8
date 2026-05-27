export type SurfaceId = 'public' | 'civic' | 'dating'
export type SectionId = 'home' | 'grants' | 'providers' | 'safety' | 'civic'
export type Visibility = 'Public' | 'Trusted only' | 'Private'
export type SurfaceState = 'Live' | 'Limited' | 'Muted'

export type ClaimType =
  | 'is_verified_public_figure'
  | 'is_civic_eligible'
  | 'has_para_verification'
  | 'has_party_affiliation_match'
  | 'is_age_eligible'
  | 'has_backup_coverage'

export type ParaClaimType = ClaimType
export type GrantProofMode = 'proof-only' | 'attested' | 'compatibility-only'
export type ProofMode = GrantProofMode
export type GrantStatus =
  | 'Active'
  | 'Pending approval'
  | 'Revoked'
  | 'Expired'
  | 'pending'
  | 'approved'
  | 'revoked'
  | 'expired'
export type GrantState = 'Live' | 'Needs review' | 'Paused'
export type ClaimRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Revoked'
  | 'Expired'
  | 'pending'
  | 'approved'
  | 'rejected'
export type ProofStatus =
  | 'Active'
  | 'Revoked'
  | 'Expired'
  | 'pending'
  | 'active'
  | 'revoked'
  | 'expired'
export type ProviderTrustLevel = 'Trusted' | 'Scoped' | 'Core' | 'Experimental' | 'Degraded'
export type LedgerAction = 'Requested' | 'Approved' | 'Revoked' | 'Expired' | 'Verified'
export type ParaPolicyRecord = 'com.para.identity'
export type ParaCompatibilityRecord = 'app.bsky.graph.verification'
export type ParaProviderStatus = {
  providerName: string
  availability: 'Online' | 'Degraded'
  lastSync: string
  policyRecord: ParaPolicyRecord
  compatibilityRecord: ParaCompatibilityRecord
  supportedClaims: ClaimType[]
  detail: string
}

export type Signal = {
  label: string
  value: string
  visibility: Visibility
  action: string
}

export type PersonaKind = 'para' | 'independent' | 'public'

export type Persona = {
  id: string
  name: string
  handle: string
  avatar?: string
  role: string
  oneLine: string
  summary: string
  kind: PersonaKind
  surfaceStates: Record<SurfaceId, SurfaceState>
  signals: Signal[]
}

export type Integration = {
  id: string
  name: string
  status: string
  summary: string
  cta: string
  surfaces: SurfaceId[]
}

export type ClaimDescriptor = {
  type: ClaimType
  label: string
  learns: string
}

export type ParaClaimCatalogItem = {
  claimType: ParaClaimType
  label: string
  description: string
  disclosure: GrantProofMode
}

export type ProofArtifact = {
  id: string
  claimType: ClaimType
  label: string
  issuer: string
  verifier: string
  audienceAppId: string
  proofRef: string
  summary: string
  issuedAt: string
  expiresAt: string
  status: ProofStatus
}

export type AppGrant = {
  id: string
  appId: string
  appName: string
  appKind: string
  surface: SurfaceId
  signals: string[]
  requestedClaims: ClaimType[]
  shareMode: GrantProofMode
  proofMode?: GrantProofMode
  state: GrantState
  status: GrantStatus
  grantedAt: string
  lastUsed: string
  expiresAt: string
  audience: string
  reason: string
  verifier: string
  issuerRecord: ParaPolicyRecord
  compatibilityRecord: ParaCompatibilityRecord
  proofArtifactIds: string[]
}

export type ClaimRequest = {
  id: string
  appId: string
  appName: string
  appKind: string
  surface: SurfaceId
  requestedClaims: ClaimType[]
  proofMode: GrantProofMode
  status: ClaimRequestStatus
  audience: string
  expiryPreference: string
  requestedAt: string
  reason: string
  verifier: string
  expiresAt?: string
}

export type ConsentLedgerEntry = {
  id: string
  action: LedgerAction
  subject: string
  detail: string
  timestamp: string
  app: string
  surface: SurfaceId
  outcome: 'Approved' | 'Revoked' | 'Expired' | 'Rejected'
}

export type SignalProvider = {
  id: string
  name: string
  kind: 'Safety' | 'Values' | 'Broker' | 'Verifier' | 'Community'
  status: ProviderTrustLevel
  routing: string
  summary: string
  signalTypes: string[]
  claimTypes: ClaimType[]
  surfaces: SurfaceId[]
  lastSync: string
}

export type ParaProviderProfile = {
  id: string
  name: string
  role: 'Policy bridge' | 'Verifier'
  status: ParaProviderStatus
  summary: string
  policyRecord: ParaPolicyRecord
  compatibilityRecord: ParaCompatibilityRecord
  supportedClaims: ClaimType[]
  proofMode: GrantProofMode
  lastSync: string
}

export type ParaBrokerSnapshot = {
  policyRecord: ParaPolicyRecord
  compatibilityRecord: ParaCompatibilityRecord
  supportedClaims: ClaimDescriptor[]
  providerStatus: ParaProviderStatus
  providers: ParaProviderProfile[]
}

export type SafetyAction = {
  title: string
  detail: string
  urgency: 'Now' | 'Soon' | 'Optional'
  onPress: () => void
  cta: string
}

export type ConsentPolicyRule = {
  title: string
  detail: string
  effect: 'Default' | 'Guardrail' | 'Stop' | 'Audit'
}

export type ConsentPolicy = {
  title: string
  summary: string
  rules: ConsentPolicyRule[]
}

export type ProofLifecycleStep = {
  id: 'request' | 'review' | 'approve' | 'issue' | 'refresh' | 'revoke'
  title: string
  detail: string
  action: string
}

export type ProofLifecycleCopy = {
  title: string
  summary: string
  steps: ProofLifecycleStep[]
}

export type PdsSafetyState =
  | 'Backed up'
  | 'Enroll now'
  | 'Needs attention'
  | 'Migrating'
  | 'Proof degraded'
  | 'Recovery paused'

export type PdsSafetySnapshot = {
  state: PdsSafetyState
  detail: string
  source: string
  lastBackup: string
}

export type PdsSafetyPolicyState = {
  state: PdsSafetyState
  summary: string
  proofImpact: string
  action: string
  severity: 'Good' | 'Warning' | 'Critical'
}

export type PdsSafetyPolicy = {
  title: string
  summary: string
  states: PdsSafetyPolicyState[]
}

export type BootstrapStatus = 'idle' | 'resolving' | 'hydrating'

export type IdentityProvider = 'bsky' | 'mastodon' | 'custom' | 'm8-native'
export type RenameStatus = 'locked' | 'available' | 'used'

export type BrokerAttempt = {
  did: string
  handle: string
  authorizationServer: string
  phaseLabel: string
  provider: IdentityProvider
}

export type IdentitySession = {
  brokerMode: 'mock' | 'local'
  did: string
  handle: string
  displayName: string
  renameStatus?: RenameStatus
  verifiedDisplayName?: string
  authorizationServer: string
  pdsSafety: PdsSafetySnapshot
  paraProvider: ParaProviderStatus
  para?: ParaBrokerSnapshot
  claimCatalog?: ClaimDescriptor[]
  pendingRequests: ClaimRequest[]
  proofArtifacts: ProofArtifact[]
  consentLedger: ConsentLedgerEntry[]
  consentPolicy?: ConsentPolicy
  proofLifecycle?: ProofLifecycleCopy
  pdsSafetyPolicy?: PdsSafetyPolicy
  personas: Persona[]
  grants: AppGrant[]
  providers: SignalProvider[]
  integrations: Integration[]
  safetyActions: SafetyAction[]
  surfaceTemplates: SurfaceTemplate[]
  commands: Record<SurfaceId, Command[]>
  ineVerification?: IneVerificationRecord
}

export type SurfaceTemplate = {
  id: string
  name: string
  audience: string
  status: 'Live' | 'Template' | 'Draft'
  traits: SurfaceTrait[]
}

export type SurfaceTrait =
  | 'discoverable'
  | 'portable'
  | 'low-friction'
  | 'proof-first'
  | 'policy-aware'
  | 'trust-receipts'
  | 'bounded-matching'
  | 'eligibility-safe'
  | 'revocable'
  | 'skills-forward'
  | 'portable-reputation'
  | 'future-grant-profile'
  | 'anonymous'
  | 'age-gated'
  | 'location-scoped'
  | 'time-boxed'
  | 'delegation-enabled'

export type NewSurfaceInput = {
  id: string
  name: string
  audience: string
  traits: SurfaceTrait[]
  status: 'Live' | 'Limited' | 'Muted'
}

export type IneVerificationStatus = 'not_started' | 'scanning' | 'ocr_processing' | 'face_matching' | 'verified' | 'failed' | 'rejected'

export type IneVerificationRecord = {
  id: string
  status: IneVerificationStatus
  curp?: string
  fullName?: string
  birthDate?: string
  gender?: 'M' | 'F' | 'X'
  stateCode?: string
  municipalityCode?: string
  section?: string
  ineNumber?: string
  cic?: string
  ocr?: string
  photoUri?: string
  verifiedAt?: string
  expiresAt?: string
  // Only proofs are shared, never raw data
  proofs: {
    isMexicanCitizen: boolean
    isAgeEligible: boolean
    ageRange?: '18-25' | '26-35' | '36-50' | '51-65' | '65+'
    state?: string
    gender?: 'M' | 'F' | 'X'
    hasIne: boolean
  }
}

export type PolicyNodeType = 'claim' | 'source' | 'position' | 'question' | 'note'

export type PolicyNode = {
  id: string
  type: PolicyNodeType
  content: string
  x: number
  y: number
  sourceRefs?: string[]
  spaceUri?: string
  createdAt: string
  updatedAt: string
}

export type PolicyEdge = {
  id: string
  from: string
  to: string
  label: 'supports' | 'contradicts' | 'questions' | 'inspired' | 'sources'
}

export type BundleStatus = 'draft' | 'submitted' | 'under_review' | 'endorsed' | 'rejected'

export type KnowledgeBundle = {
  id: string
  name: string
  nodeIds: string[]
  edgeIds: string[]
  spaceUri: string
  authorDid: string
  attachedProofs: string[]
  status: BundleStatus
  endorsements: { did: string; timestamp: string }[]
  challenges: { did: string; reason: string; timestamp: string }[]
  submittedAt?: string
}

export type PermissionedSpace = {
  did: string
  type: 'com.para.space.civic' | 'com.para.space.regional' | 'com.para.space.topic'
  name: string
  ownerDid: string
  memberDids: string[]
  requiredProofs: string[]
  endorsementThreshold: number
}

export type Command = {
  title: string
  detail: string
}

export type StartSessionRequest = {
  identifier: string
  provider?: IdentityProvider
}

export type StartSessionResponse = {
  identity: BrokerAttempt
  authUrl: string
  sessionStub: {
    broker: 'm8'
    proofMode: GrantProofMode
  }
}

export type GrantRequestInput = {
  appId: string
  appName: string
  appKind: string
  surface: SurfaceId
  requestedClaims: ClaimType[]
  audience: string
  expiryPreference: string
  reason: string
  verifier: string
}

export type VerifyClaimInput = {
  claimType: ClaimType
  appId: string
  handle: string
  audience: string
}

export type VerifyClaimResult = {
  artifact: ProofArtifact
  detail: string
}
