import { tokens } from '../../theme'
import type { SurfaceId, IdentitySession, Persona, RenameStatus } from '../../types'
import type { IconName } from '../../components/m8/Icon'

// Sentinel persona id for the header's "+ Public" slot when no public persona exists yet.
export const PUBLIC_SLOT_ID = 'public-slot'

// Short friendly label for header segments and the dashboard badge.
// Persona `name` is the raw handle; `role` carries the human descriptor.
export function personaLabel(persona: Persona, index: number): string {
  if (persona.kind === 'public') return 'Public'
  const role = persona.role.toLowerCase()
  if (role.includes('civic')) return 'Main'
  if (role.includes('independent') || role.includes('isolated')) return 'Alt'
  return `Anon ${index + 1}`
}

export const SURFACE_META: Record<SurfaceId, { label: string; color: string; icon: IconName }> = {
  public: { label: 'Public', color: tokens.success, icon: 'globe' },
  civic: { label: 'PARA', color: tokens.accent, icon: 'shieldCheck' },
}

export const CLAIM_LABELS: Record<string, string> = {
  is_verified_public_figure: 'Verified public figure',
  is_civic_eligible: 'PARA eligibility',
  has_para_verification: 'PARA verification',
  has_party_affiliation_match: 'Party affiliation match',
  is_age_eligible: 'Age eligible',
  has_backup_coverage: 'Backup coverage',
  joined_during_founding_period: 'Founding-period membership',
  has_continuous_party_membership_30d: '30-day party membership',
}

export function getRenameStatus(session: IdentitySession, isVerified: boolean): RenameStatus {
  if (session.renameStatus) return session.renameStatus
  return isVerified ? 'available' : 'locked'
}
