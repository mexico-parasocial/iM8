import { useMemo } from 'react'
import type { AppGrant, ClaimRequest, IdentitySession, Persona, PolicyChangeRequest, SurfaceId } from '../types'

export type ProfileContext = {
  surface: SurfaceId
  surfaceLabel: string
  pendingRequests: ClaimRequest[]
  grants: AppGrant[]
  policyChangeRequests: PolicyChangeRequest[]
}

export function useProfileContext(
  session: IdentitySession,
  activePersona: Persona | undefined
): ProfileContext {
  return useMemo(() => {
    const surface: SurfaceId = activePersona?.kind === 'public' ? 'public' : 'civic'
    const surfaceLabel = surface === 'public' ? 'Public' : 'PARA'

    return {
      surface,
      surfaceLabel,
      pendingRequests: session.pendingRequests.filter((r) => r.surface === surface),
      grants: session.grants.filter((g) => g.surface === surface),
      policyChangeRequests: (session.policyChangeRequests ?? []).filter((r) => {
        // Policy change requests don't have a surface field — show them for all profiles
        // since they affect the session globally.
        return true
      }),
    }
  }, [session, activePersona])
}
