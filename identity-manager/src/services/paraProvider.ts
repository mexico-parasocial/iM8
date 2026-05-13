import { env } from '../config/env.js'
import type { ProofBrokerClaimType, ProofBrokerParaProviderStatus } from '../types/index.js'

export type ParaClaimVerificationResult = {
  claimType: ProofBrokerClaimType
  subject: string
  disposition: 'verified' | 'bounded' | 'review-needed' | 'unavailable' | 'not-verified'
  outcome: 'verified' | 'not-verified' | 'matched' | 'mismatched' | 'bounded' | null
  requestedValue: string | null
  statement: string
  reference: string | null
  notes: string
  evaluatedAt: string
}

function nowIso() {
  return new Date().toISOString()
}

export async function resolveParaProviderStatus(): Promise<ProofBrokerParaProviderStatus> {
  const hasApi = Boolean(env.PARA_API_BASE_URL)

  if (hasApi) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), env.PARA_API_TIMEOUT_MS)
      const res = await fetch(`${env.PARA_API_BASE_URL}/xrpc/app.bsky.actor.getProfile?actor=para.verifier`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (res.ok) {
        return {
          providerId: 'para.identity',
          displayName: 'PARA Trust MX',
          availability: 'online',
          compatibility: 'ready',
          policyRecord: 'com.para.identity',
          compatibilityRecord: 'app.bsky.graph.verification',
          lastSyncAt: nowIso(),
          supportedClaims: ['is_verified_public_figure', 'is_civic_eligible', 'has_para_verification', 'has_party_affiliation_match'],
          notes: 'PARA API reachable. Real-time verification enabled.',
        }
      }
    } catch {
      // fall through to degraded
    }
  }

  return {
    providerId: 'para.identity',
    displayName: 'PARA Trust MX',
    availability: hasApi ? 'degraded' : 'online',
    compatibility: 'needs-review',
    policyRecord: 'com.para.identity',
    compatibilityRecord: 'app.bsky.graph.verification',
    lastSyncAt: nowIso(),
    supportedClaims: ['is_verified_public_figure', 'is_civic_eligible', 'has_para_verification', 'has_party_affiliation_match'],
    notes: hasApi
      ? 'PARA API is configured but unreachable. Operating in degraded mode.'
      : 'No PARA_API_BASE_URL configured. Using local seed resolution.',
  }
}

export async function verifyParaClaim(input: {
  subject: string
  claimType: ProofBrokerClaimType
  requestedValue?: string
  audienceAppId: string
  audienceAppName: string
  reason: string
}): Promise<ParaClaimVerificationResult> {
  const hasApi = Boolean(env.PARA_API_BASE_URL)

  if (hasApi) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), env.PARA_API_TIMEOUT_MS)
      const res = await fetch(`${env.PARA_API_BASE_URL}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(input.subject)}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (res.ok) {
        const profile = (await res.json()) as Record<string, unknown>
        const verified = Boolean(profile?.verification)

        if (input.claimType === 'has_para_verification' || input.claimType === 'is_verified_public_figure') {
          if (verified) {
            return {
              claimType: input.claimType,
              subject: input.subject,
              disposition: 'verified',
              outcome: 'verified',
              requestedValue: input.requestedValue ?? null,
              statement: `PARA API confirms ${input.claimType} for ${input.subject}.`,
              reference: (profile.did as string) ?? null,
              notes: 'Resolved via live PARA API.',
              evaluatedAt: nowIso(),
            }
          }
        }
      }
    } catch {
      // fall through to local resolution
    }
  }

  // Local fallback (simplified from POC seed logic)
  const isDemoVerified = input.subject.toLowerCase().includes('demo') || input.subject.toLowerCase().includes('test')

  if (input.claimType === 'has_party_affiliation_match') {
    return {
      claimType: input.claimType,
      subject: input.subject,
      disposition: 'bounded',
      outcome: 'bounded',
      requestedValue: input.requestedValue ?? 'independent',
      statement: `Bounded party affiliation match: ${input.requestedValue ?? 'independent'}`,
      reference: `local:party:${input.subject}`,
      notes: 'Resolved via local fallback (no PARA API).',
      evaluatedAt: nowIso(),
    }
  }

  if (isDemoVerified) {
    return {
      claimType: input.claimType,
      subject: input.subject,
      disposition: 'verified',
      outcome: 'verified',
      requestedValue: input.requestedValue ?? null,
      statement: `Local verification confirms ${input.claimType} for demo subject.`,
      reference: `local:${input.subject}`,
      notes: 'Resolved via local fallback (demo mode).',
      evaluatedAt: nowIso(),
    }
  }

  return {
    claimType: input.claimType,
    subject: input.subject,
    disposition: 'not-verified',
    outcome: 'not-verified',
    requestedValue: input.requestedValue ?? null,
    statement: `No verification record found for ${input.claimType}.`,
    reference: null,
    notes: 'Local fallback returned no match.',
    evaluatedAt: nowIso(),
  }
}
