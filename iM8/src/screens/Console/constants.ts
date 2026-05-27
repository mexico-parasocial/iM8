import { tokens } from '../../theme'
import type { SurfaceId, IdentitySession, RenameStatus } from '../../types'
import type { IconName } from '../../components/m8/Icon'

export const SURFACE_META: Record<SurfaceId, { label: string; color: string; icon: IconName }> = {
  public: { label: 'Public', color: tokens.success, icon: 'globe' },
  civic: { label: 'Civic', color: tokens.accent, icon: 'shieldCheck' },
  dating: { label: 'Dating', color: '#a78bfa', icon: 'personGroup' },
}

export const CLAIM_LABELS: Record<string, string> = {
  is_verified_public_figure: 'Verified public figure',
  is_civic_eligible: 'Civic eligibility',
  has_para_verification: 'PARA verification',
  has_party_affiliation_match: 'Party affiliation match',
  is_age_eligible: 'Age eligible',
  has_backup_coverage: 'Backup coverage',
}

export function getRenameStatus(session: IdentitySession, isVerified: boolean): RenameStatus {
  if (session.renameStatus) return session.renameStatus
  return isVerified ? 'available' : 'locked'
}
