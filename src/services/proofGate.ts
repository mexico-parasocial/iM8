import { gateAudienceFor } from '../contracts/gatedSpaces'
import type { ProofBrokerClaimType } from '../contracts/proofBroker'
import type { ProofArtifact } from '../types'

/**
 * Client-side prediction of a proof gate's decision.
 *
 * The authoritative check runs server-side: the space authority asks mubEZ,
 * which checks the requesting DID's artifacts. This evaluator runs the same
 * policy over the session's own artifacts so the UI can say "you qualify",
 * "you're missing X", or "your proof is there but unverified" — the last
 * being the honest state today, while the broker does not yet sign.
 *
 * An artifact satisfies a required claim only when it is Active, minted for
 * this gate's audience (the space URI), and client-verified as `verified`.
 * Anything less is reported per claim with a reason, never silently trusted.
 */

export type ProofGateClaimResult =
  | { claimType: ProofBrokerClaimType; state: 'satisfied' }
  | { claimType: ProofBrokerClaimType; state: 'missing' }
  | { claimType: ProofBrokerClaimType; state: 'unverified'; reason: string }

export type ProofGateEvaluation = {
  admitted: boolean
  claims: ProofGateClaimResult[]
}

function artifactReason(artifact: ProofArtifact, audience: string): string {
  if (artifact.status !== 'Active') return `artifact-${artifact.status.toLowerCase()}`
  if (artifact.audienceAppId !== audience) return 'wrong-audience'
  if (artifact.verification === undefined) return 'not-checked'
  return artifact.verification.status
}

export function evaluateProofGate(input: {
  requiredClaims: readonly ProofBrokerClaimType[]
  artifacts: readonly ProofArtifact[]
  /** The audience gate artifacts must carry: the space URI. */
  audience: string
}): ProofGateEvaluation {
  const audience = gateAudienceFor(input.audience)
  const claims: ProofGateClaimResult[] = input.requiredClaims.map((claimType) => {
    const candidates = input.artifacts.filter((artifact) => artifact.claimType === claimType)

    const usable = candidates.some(
      (artifact) =>
        artifact.status === 'Active' &&
        artifact.audienceAppId === audience &&
        artifact.verification?.status === 'verified'
    )
    if (usable) return { claimType, state: 'satisfied' as const }

    if (candidates.length === 0) return { claimType, state: 'missing' as const }

    // Prefer the most informative failure: a verification outcome outranks a
    // lifecycle or audience problem, because it says "we checked and it did
    // not hold" rather than "the broker's bookkeeping says no".
    const withVerification = candidates.find(
      (artifact) =>
        artifact.verification !== undefined &&
        artifact.status === 'Active' &&
        artifact.audienceAppId === audience
    )
    return {
      claimType,
      state: 'unverified' as const,
      reason: artifactReason(withVerification ?? candidates[0], audience),
    }
  })

  return { admitted: claims.every((claim) => claim.state === 'satisfied'), claims }
}
