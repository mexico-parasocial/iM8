import { type ClaimType, type ParaProviderStatus } from '../types'

const paraClaims: ClaimType[] = [
  'is_verified_public_figure',
  'is_civic_eligible',
  'has_para_verification',
  'is_age_eligible',
  'has_party_affiliation_match',
  'joined_during_founding_period',
  'has_continuous_party_membership_30d',
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
