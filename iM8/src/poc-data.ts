import {
  type AppGrant,
  type ClaimDescriptor,
  type ClaimRequest,
  type Command,
  type Integration,
  type Persona,
  type ProofArtifact,
  type SectionId,
  type SignalProvider,
  type SurfaceId,
  type SurfaceTemplate,
} from './types'

export const surfaces: { id: SurfaceId; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'civic', label: 'Civic' },
  { id: 'dating', label: 'Dating' },
]

export const sections: { id: SectionId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'grants', label: 'Grants' },
  { id: 'providers', label: 'Providers' },
  { id: 'safety', label: 'Safety' },
]

export function buildPersonas(handle: string): Persona[] {
  const handleRoot = handle.startsWith('@') ? handle.slice(1).split('.')[0] : handle.split('.')[0]

  return [
    {
      id: '1',
      name: 'Card 1',
      handle: `@${handle}`,
      role: 'PARA default',
      oneLine: 'Anonymous by default. Your main civic voice.',
      summary:
        'This is your primary PARA identity. Anonymous by default, it carries your civic proofs — eligibility, verification, party affiliation — without exposing the raw data behind them. When you vote on a policy, this is the face that speaks.',
      kind: 'para',
      surfaceStates: { public: 'Limited', civic: 'Live', dating: 'Muted' },
      signals: [
        {
          label: 'Visibility',
          value: 'Anonymous by default',
          visibility: 'Public',
          action: 'Preview',
        },
        {
          label: 'Civic proofs',
          value: 'Eligibility, verification, affiliation',
          visibility: 'Trusted only',
          action: 'Inspect',
        },
        {
          label: 'Voting power',
          value: 'One vote per policy, guaranteed',
          visibility: 'Private',
          action: 'Review',
        },
      ],
    },
    {
      id: '2',
      name: 'Card 2',
      handle: `@${handleRoot}.independent`,
      role: 'Independent anonymous',
      oneLine: 'Post freely without linking to your main identity.',
      summary:
        'A second anonymous layer for independent posts, experiments, or sensitive topics. No one can connect Card 2 back to Card 1 or your central identity — unless you choose to reveal it.',
      kind: 'independent',
      surfaceStates: { public: 'Limited', civic: 'Limited', dating: 'Muted' },
      signals: [
        {
          label: 'Visibility',
          value: 'Anonymous, unlinked to Card 1',
          visibility: 'Public',
          action: 'Preview',
        },
        {
          label: 'Use case',
          value: 'Independent posts, whistleblowing, experiments',
          visibility: 'Public',
          action: 'Preview',
        },
        {
          label: 'Cross-linking',
          value: 'Disabled by default',
          visibility: 'Private',
          action: 'Review',
        },
      ],
    },
    {
      id: '3',
      name: 'Card 3',
      handle: `@${handleRoot}.public`,
      role: 'Public profile',
      oneLine: 'Link to Bluesky, Mastodon, or stay m8-native.',
      summary:
        'Your public-facing identity. Link it to Bluesky, Mastodon, or any social network. Use it for discovery, creative work, networking — or keep it dormant until you need it.',
      kind: 'public',
      surfaceStates: { public: 'Live', civic: 'Muted', dating: 'Live' },
      signals: [
        {
          label: 'Visibility',
          value: 'Public, discoverable',
          visibility: 'Public',
          action: 'Preview',
        },
        {
          label: 'External links',
          value: 'Bluesky, Mastodon, personal site',
          visibility: 'Public',
          action: 'Manage',
        },
        {
          label: 'Creative portfolio',
          value: 'Optional proof-backed claims',
          visibility: 'Public',
          action: 'Manage',
        },
      ],
    },
  ]
}

export function buildIntegrations(): Integration[] {
  return [
    {
      id: 'atmos-dating',
      name: 'Atmos Dating beta',
      status: 'Consumes proof-only grants',
      summary: 'Requests bounded compatibility and age claims from the dating surface.',
      cta: 'Open',
      surfaces: ['dating'],
    },
    {
      id: 'townhall-civic',
      name: 'Townhall Civic',
      status: 'Awaiting approval',
      summary: 'Requests civic eligibility and PARA verification without touching raw identity paperwork.',
      cta: 'Review',
      surfaces: ['civic'],
    },
    {
      id: 'neighborhood-wallet',
      name: 'Neighborhood wallet',
      status: 'Revoked path',
      summary: 'An older local proof flow that now requires a narrower claim model before it can return.',
      cta: 'Inspect',
      surfaces: ['public', 'civic'],
    },
  ]
}

export function buildClaimCatalog(): ClaimDescriptor[] {
  return [
    {
      type: 'is_verified_public_figure',
      label: 'Verified public figure',
      learns: 'The app learns a yes or no outcome backed by PARA, not the manual review materials.',
    },
    {
      type: 'is_civic_eligible',
      label: 'Civic eligibility',
      learns: 'The app learns that the account passed the required civic check without receiving source documents.',
    },
    {
      type: 'has_para_verification',
      label: 'PARA verification',
      learns: 'The app learns whether PARA has already verified the identity for its intended use case.',
    },
    {
      type: 'has_party_affiliation_match',
      label: 'Party affiliation match',
      learns: 'The app learns only a yes/no or bounded match result, never the full values graph.',
    },
    {
      type: 'is_age_eligible',
      label: 'Age eligible',
      learns: 'The app learns whether the age gate passed, not the date of birth.',
    },
    {
      type: 'has_backup_coverage',
      label: 'Backup coverage',
      learns: 'The app learns whether the identity has portable recovery coverage in place.',
    },
  ]
}

export function buildProofArtifacts(): ProofArtifact[] {
  return [
    {
      id: 'proof-dating-alignment',
      claimType: 'has_party_affiliation_match',
      label: 'Party affiliation match',
      issuer: 'PARA verifier',
      verifier: 'm8 broker',
      audienceAppId: 'atmos-dating',
      proofRef: 'para://spark/affiliation-match',
      summary: 'Dating app receives a bounded alignment result instead of a full civic profile.',
      issuedAt: 'Today',
      expiresAt: '30 days',
      status: 'Active',
    },
    {
      id: 'proof-dating-age',
      claimType: 'is_age_eligible',
      label: 'Age eligible',
      issuer: 'Age assurance',
      verifier: 'm8 broker',
      audienceAppId: 'atmos-dating',
      proofRef: 'assurance://spark/age-eligible',
      summary: 'Confirms the age gate without exposing date of birth.',
      issuedAt: 'Today',
      expiresAt: '30 days',
      status: 'Active',
    },
    {
      id: 'proof-wallet-backup',
      claimType: 'has_backup_coverage',
      label: 'Backup coverage',
      issuer: 'PDS MOOver',
      verifier: 'm8 broker',
      audienceAppId: 'neighborhood-wallet',
      proofRef: 'pdsmoover://orbit/backup',
      summary: 'Older backup coverage proof retained for audit after grant revocation.',
      issuedAt: 'Last week',
      expiresAt: 'Expired',
      status: 'Revoked',
    },
  ]
}

export function buildAppGrants(): AppGrant[] {
  return [
    {
      id: 'grant-dating-beta',
      appId: 'atmos-dating',
      appName: 'Atmos Dating beta',
      appKind: 'Consumer app',
      surface: 'dating',
      signals: ['has_party_affiliation_match', 'is_age_eligible'],
      requestedClaims: ['has_party_affiliation_match', 'is_age_eligible'],
      shareMode: 'proof-only',
      state: 'Live',
      status: 'Active',
      grantedAt: 'Today',
      lastUsed: '2 hours ago',
      expiresAt: '30 days',
      audience: 'Matchmaking and safety checks',
      reason: 'The app gets compatibility and age proofs only, not the underlying civic values or identity records.',
      verifier: 'PARA verifier + age assurance',
      issuerRecord: 'com.para.identity',
      compatibilityRecord: 'app.bsky.graph.verification',
      proofArtifactIds: ['proof-dating-alignment', 'proof-dating-age'],
    },
    {
      id: 'grant-neighborhood-wallet',
      appId: 'neighborhood-wallet',
      appName: 'Neighborhood wallet',
      appKind: 'Local app',
      surface: 'public',
      signals: ['has_backup_coverage'],
      requestedClaims: ['has_backup_coverage'],
      shareMode: 'proof-only',
      state: 'Paused',
      status: 'Revoked',
      grantedAt: 'Last week',
      lastUsed: 'Not recently',
      expiresAt: 'Expired',
      audience: 'Recovery reassurance',
      reason: 'The previous grant was revoked because its retention rules and audience boundaries were too loose.',
      verifier: 'PDS MOOver',
      issuerRecord: 'com.para.identity',
      compatibilityRecord: 'app.bsky.graph.verification',
      proofArtifactIds: ['proof-wallet-backup'],
    },
  ]
}

export function buildClaimRequests(): ClaimRequest[] {
  return [
    {
      id: 'request-townhall-civic',
      appId: 'townhall-civic',
      appName: 'Townhall Civic',
      appKind: 'Civic app',
      surface: 'civic',
      requestedClaims: ['is_civic_eligible', 'has_para_verification'],
      proofMode: 'proof-only',
      status: 'Pending',
      audience: 'Public-interest discussion and moderation',
      expiryPreference: '14 days',
      requestedAt: '10 minutes ago',
      reason: 'Townhall wants civic eligibility and trusted participation checks without seeing source paperwork.',
      verifier: 'PARA verifier',
    },
    {
      id: 'request-public-figure-feed',
      appId: 'public-figure-feed',
      appName: 'Public Figure Feed',
      appKind: 'Media app',
      surface: 'civic',
      requestedClaims: ['is_verified_public_figure'],
      proofMode: 'proof-only',
      status: 'Pending',
      audience: 'Profile presentation in public discovery',
      expiryPreference: '30 days',
      requestedAt: '1 hour ago',
      reason: 'The feed only needs public-figure status to drive a badge and ranking policy.',
      verifier: 'PARA verifier',
    },
  ]
}

export function buildSignalProviders(): SignalProvider[] {
  return [
    {
      id: 'pds-moover',
      name: 'PDS MOOver',
      kind: 'Safety',
      status: 'Trusted',
      routing: 'Recovery and portability only',
      summary: 'Supplies backup coverage and migration posture that can be turned into proof-safe claims.',
      signalTypes: ['backup health', 'migration readiness', 'missing blob alerts'],
      claimTypes: ['has_backup_coverage'],
      surfaces: ['public', 'civic', 'dating'],
      lastSync: '6 hours ago',
    },
    {
      id: 'para-verifier',
      name: 'PARA verifier',
      kind: 'Verifier',
      status: 'Core',
      routing: 'Civic proof issuance and durable policy',
      summary: 'Writes durable PARA policy and can emit compatibility verification while keeping the app payload proof-shaped.',
      signalTypes: [
        'verified public figure',
        'civic eligibility',
        'para verification',
        'party affiliation match',
      ],
      claimTypes: [
        'is_verified_public_figure',
        'is_civic_eligible',
        'has_para_verification',
        'has_party_affiliation_match',
      ],
      surfaces: ['civic', 'dating'],
      lastSync: '2 minutes ago',
    },
    {
      id: 'm8-broker',
      name: 'm8 broker',
      kind: 'Broker',
      status: 'Core',
      routing: 'Session bootstrap and consent ledger',
      summary: 'Owns auth resolution, consent, proof orchestration, and the current mobile session.',
      signalTypes: ['session identity', 'authorization context', 'consent ledger'],
      claimTypes: ['has_backup_coverage'],
      surfaces: ['public', 'civic', 'dating'],
      lastSync: 'Live',
    },
    {
      id: 'paramx-social',
      name: 'paramx.social',
      kind: 'Values',
      status: 'Scoped',
      routing: 'Future bounded matching only',
      summary: 'Reserved for later imported values, but only through bounded proof outputs rather than raw ideology payloads.',
      signalTypes: ['bounded values', 'compatibility card'],
      claimTypes: ['has_party_affiliation_match'],
      surfaces: ['civic', 'dating'],
      lastSync: 'Not linked yet',
    },
  ]
}

export function buildSurfaceTemplates(): SurfaceTemplate[] {
  return [
    {
      id: 'public-template',
      name: 'Public',
      audience: 'Default social face across the network',
      status: 'Live',
      traits: ['discoverable', 'portable', 'low-friction'],
    },
    {
      id: 'civic-template',
      name: 'Civic',
      audience: 'Communities, public-interest spaces, and governance',
      status: 'Live',
      traits: ['proof-first', 'policy-aware', 'trust-receipts'],
    },
    {
      id: 'dating-template',
      name: 'Dating',
      audience: 'Relationship discovery with stronger boundaries',
      status: 'Live',
      traits: ['bounded-matching', 'eligibility-safe', 'revocable'],
    },
    {
      id: 'work-template',
      name: 'Work',
      audience: 'Professional and project-facing spaces',
      status: 'Template',
      traits: ['skills-forward', 'portable-reputation', 'future-grant-profile'],
    },
  ]
}

export function buildCommandDeck(): Record<SurfaceId, Command[]> {
  return {
    public: [
      {
        title: 'Keep the default profile easy to read',
        detail: 'Public apps should receive display basics and proof-safe backup posture, not internal civic data.',
      },
      {
        title: 'Scope every app to one audience',
        detail: 'Treat each grant like a contract for one purpose, one surface, and one expiry window.',
      },
      {
        title: 'Keep recovery outside the profile',
        detail: 'PDS MOOver strengthens the account without turning admin details into public identity.',
      },
    ],
    civic: [
      {
        title: 'Use PARA as the verifier, not the wallet',
        detail: 'Store durable civic policy in PARA while m8 remains the consent and disclosure layer.',
      },
      {
        title: 'Share proofs, not paperwork',
        detail: 'Apps should learn civic eligibility or verification outcomes without seeing source documents.',
      },
      {
        title: 'Keep compatibility records downstream',
        detail: 'Use app.bsky.graph.verification only when existing clients need it, not as the main policy object.',
      },
    ],
    dating: [
      {
        title: 'Keep matching bounded',
        detail: 'Dating apps should receive bounded affiliation or compatibility outputs, never full ideology vectors.',
      },
      {
        title: 'Expire sensitive proofs quickly',
        detail: 'Short-lived proofs make revocation practical when relationships or app trust change.',
      },
      {
        title: 'Preserve stronger boundaries',
        detail: 'Age and safety checks can be disclosed without exposing exact age, location, or legal identity.',
      },
    ],
  }
}

export function sectionTitle(section: SectionId | 'mybase') {
  if (section === 'home') return 'Proof broker'
  if (section === 'grants') return 'Grant review'
  if (section === 'providers') return 'Providers and apps'
  if (section === 'mybase') return 'MyBase'
  return 'Trust and safety'
}
