import { type ClaimType, type ParaProviderStatus, type VerifyClaimInput, type VerifyClaimResult } from '../types'

const paraClaims: ClaimType[] = [
  'is_verified_public_figure',
  'is_civic_eligible',
  'has_para_verification',
  'is_age_eligible',
  'has_party_affiliation_match',
]

export function buildParaProviderStatus(handle: string): ParaProviderStatus {
  const degraded = handle.includes('recover') || handle.includes('move')

  return {
    providerName: 'PARA identity',
    availability: degraded ? 'Degraded' : 'Online',
    lastSync: degraded ? '18 minutes ago' : '2 minutes ago',
    policyRecord: 'com.para.identity',
    compatibilityRecord: 'app.bsky.graph.verification',
    supportedClaims: paraClaims,
    detail: degraded
      ? 'Verification compatibility is available, but policy sync is delayed while the account safety posture is being reviewed.'
      : 'Writes durable civic policy to com.para.identity and can emit compatibility-facing verification for current clients.',
  }
}

export function getParaClaimCatalog() {
  return [
    {
      type: 'is_verified_public_figure' as const,
      label: 'Verified public figure',
      learns: 'A yes or no result backed by PARA policy, not the review materials.',
    },
    {
      type: 'is_civic_eligible' as const,
      label: 'Civic eligibility',
      learns: 'A proof that the account passed civic eligibility checks without exposing source documents.',
    },
    {
      type: 'has_para_verification' as const,
      label: 'PARA verification',
      learns: 'Whether PARA has issued a trusted verification outcome for this identity.',
    },
    {
      type: 'is_age_eligible' as const,
      label: 'Age eligible',
      learns: 'A proof that the age gate passed without revealing the birth date or source document.',
    },
    {
      type: 'has_party_affiliation_match' as const,
      label: 'Party affiliation match',
      learns: 'A bounded match result only, never the full values payload or source account history.',
    },
  ]
}

export function verifyParaClaim(input: VerifyClaimInput): VerifyClaimResult {
  const label = getParaClaimCatalog().find((claim) => claim.type === input.claimType)?.label ?? input.claimType

  return {
    artifact: {
      id: `proof-${input.appId}-${input.claimType}`,
      claimType: input.claimType,
      label,
      issuer: 'PARA verifier',
      verifier: 'm8 broker',
      audienceAppId: input.appId,
      proofRef: `para://${input.handle}/${input.claimType}`,
      summary: `${label} shared in proof-only mode for ${input.audience}.`,
      issuedAt: 'Now',
      expiresAt: '30 days',
      status: 'Active',
    },
    detail:
      input.claimType === 'has_party_affiliation_match'
        ? 'PARA returns a bounded alignment result rather than the underlying civic values payload.'
        : input.claimType === 'is_age_eligible'
          ? 'PARA returns an age-eligible proof without exposing the date of birth or source document.'
        : `PARA verified ${label.toLowerCase()} and stored durable policy state in com.para.identity.`,
  }
}
