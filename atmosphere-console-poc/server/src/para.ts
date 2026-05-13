import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  ProofBrokerClaimType,
  ProofBrokerParaProviderStatus,
  ProofBrokerProofArtifact,
  ProofBrokerProofOutcome,
  ProofBrokerVerifierId,
} from '../../src/contracts/proofBroker.ts'

type CivicSeedManifest = {
  seedId?: string
  version?: string
  actors?: Array<{
    alias: string
    handle: string
    displayName?: string
    roles?: string[]
    identity?: {
      createdAt?: string
      isVerifiedPublicFigure?: boolean
      verifiedAt?: string
      proofBlob?: string
    }
  }>
  verificationRecords?: Array<{
    issuer: string
    subject: string
    rkey: string
    createdAt: string
  }>
}

type SeedActor = NonNullable<CivicSeedManifest['actors']>[number]

type ReviewNeeded = {
  status: 'review-needed'
  reason: string
}

type Confirmed = {
  status: 'confirmed'
  proof: ProofBrokerProofArtifact
}

export type ParaVerificationResult = Confirmed | ReviewNeeded

const DEFAULT_MANIFEST_PATH = resolve(
  process.cwd(),
  '..',
  '..',
  '..',
  'MASTER',
  'PARA',
  'scripts',
  'civic-seed',
  'manifest.v1.json'
)

const supportedClaims: ProofBrokerClaimType[] = [
  'is_verified_public_figure',
  'is_civic_eligible',
  'has_para_verification',
  'has_party_affiliation_match',
  'is_age_eligible',
]

function nowIso() {
  return new Date().toISOString()
}

function readManifest(): CivicSeedManifest | null {
  const manifestPath = process.env.PARA_SEED_PATH || DEFAULT_MANIFEST_PATH

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as CivicSeedManifest
  } catch {
    return null
  }
}

function normalizeKey(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function variants(value: string) {
  const normalized = normalizeKey(value)
  return new Set([
    normalized,
    normalized.replace(/[._]/g, '-'),
    normalized.replace(/-/g, '_'),
  ])
}

function findActor(manifest: CivicSeedManifest | null, subject: string) {
  const keys = variants(subject)

  return (
    manifest?.actors?.find((actor) => {
      const candidates = [actor.alias, actor.handle, actor.displayName ?? ''].map(normalizeKey)
      return candidates.some((candidate) => keys.has(candidate))
    }) ?? null
  )
}

function findVerificationRecord(manifest: CivicSeedManifest | null, actor: SeedActor | null) {
  if (!manifest || !actor) return null

  const actorKeys = variants(actor.alias)
  const handleKeys = variants(actor.handle)

  return (
    manifest.verificationRecords?.find((record) => {
      const subject = normalizeKey(record.subject)
      return actorKeys.has(subject) || handleKeys.has(subject)
    }) ?? null
  )
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => !Number.isNaN(value))

  if (!timestamps.length) {
    return nowIso()
  }

  return new Date(Math.max(...timestamps)).toISOString()
}

function createProofArtifact(params: {
  claimType: ProofBrokerClaimType
  requestedValue: string | undefined
  issuerId: ProofBrokerVerifierId
  verifierId: ProofBrokerVerifierId
  audienceAppId: string
  audienceAppName: string
  surface: 'public' | 'civic' | 'dating'
  statement: string
  outcome: ProofBrokerProofOutcome
  reference: string
}) {
  const issuedAt = nowIso()

  return {
    id: `proof-${params.audienceAppId}-${params.claimType}-${issuedAt}`,
    grantId: '',
    requestId: '',
    claimType: params.claimType,
    requestedValue: params.requestedValue ?? null,
    outcome: params.outcome,
    statement: params.statement,
    proofMode: 'proof-only',
    issuerId: params.issuerId,
    verifierId: params.verifierId,
    audienceAppId: params.audienceAppId,
    audienceAppName: params.audienceAppName,
    surface: params.surface,
    reference: params.reference,
    status: 'active',
    issuedAt,
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
  } satisfies ProofBrokerProofArtifact
}

export function buildParaProviderStatus(handle: string): ProofBrokerParaProviderStatus {
  const manifest = readManifest()
  const actor = findActor(manifest, handle)
  const record = findVerificationRecord(manifest, actor)
  const hasManifest = Boolean(manifest)
  const hasTrustedRecord = Boolean(record && actor?.identity?.isVerifiedPublicFigure)

  return {
    providerId: 'para.identity',
    displayName: manifest?.actors?.find((entry) => entry.roles?.includes('verifier'))?.displayName ?? 'PARA Trust MX',
    availability: hasManifest ? 'online' : 'offline',
    compatibility: hasTrustedRecord
      ? 'ready'
      : actor
        ? 'scoped'
        : 'needs-review',
    policyRecord: 'com.para.identity',
    compatibilityRecord: 'app.bsky.graph.verification',
    lastSyncAt: latestTimestamp([
      ...manifest?.verificationRecords?.map((entry) => entry.createdAt) ?? [],
      actor?.identity?.verifiedAt ?? null,
      actor?.identity?.createdAt ?? null,
    ]),
    supportedClaims: supportedClaims,
    notes: !manifest
      ? 'PARA civic seed manifest could not be loaded.'
      : !actor
        ? `No civic seed actor matched "${handle}".`
        : hasTrustedRecord
          ? 'Seeded com.para.identity and app.bsky.graph.verification records are available.'
          : actor.identity?.isVerifiedPublicFigure
            ? 'com.para.identity is present, but no trusted compatibility record was found.'
            : 'The civic seed actor exists but is not verified as a public figure.',
  }
}

export function verifyParaClaim(
  handle: string,
  claimType: ProofBrokerClaimType,
  input: {
    appId: string
    appName: string
    surface: 'public' | 'civic' | 'dating'
  },
  requestedValue?: string
): ParaVerificationResult {
  const manifest = readManifest()
  const actor = findActor(manifest, handle)
  const record = findVerificationRecord(manifest, actor)
  const policy = buildParaProviderStatus(handle)
  const compatibility = policy

  if (claimType === 'has_party_affiliation_match') {
    return {
      status: 'review-needed',
      reason:
        actor && manifest
          ? 'Party-affiliation data is not present in the civic seed, so the broker cannot invent a match.'
          : 'The subject is not present in the civic seed.',
    }
  }

  if (claimType === 'is_age_eligible') {
    return {
      status: 'review-needed',
      reason: 'Age eligibility is not represented in the PARA civic seed manifest.',
    }
  }

  if (claimType === 'has_para_verification') {
    if (actor?.identity?.isVerifiedPublicFigure && record) {
      return {
        status: 'confirmed',
        proof: createProofArtifact({
          claimType,
          requestedValue,
          issuerId: 'para.identity',
          verifierId: 'm8.broker',
          audienceAppId: input.appId,
          audienceAppName: input.appName,
          surface: input.surface,
          statement: 'PARA verification is present and bridged into a trusted compatibility record.',
          outcome: 'verified',
          reference: `app.bsky.graph.verification://${record.issuer}/${record.subject}/${record.rkey}`,
        }),
      }
    }

    return {
      status: 'review-needed',
      reason: actor
        ? 'The subject exists in the seed, but no trusted compatibility record is available.'
        : 'The subject is not present in the civic seed.',
    }
  }

  if (claimType === 'is_verified_public_figure' || claimType === 'is_civic_eligible') {
    if (actor?.identity?.isVerifiedPublicFigure && record) {
      return {
        status: 'confirmed',
        proof: createProofArtifact({
          claimType,
          requestedValue,
          issuerId: 'para.identity',
          verifierId: 'm8.broker',
          audienceAppId: input.appId,
          audienceAppName: input.appName,
          surface: input.surface,
          statement:
            claimType === 'is_verified_public_figure'
              ? 'com.para.identity marks this account as a verified public figure.'
              : 'The verified public-figure policy is present, so the civic eligibility check passes.',
          outcome: 'verified',
          reference: actor.identity.proofBlob ?? record.rkey,
        }),
      }
    }

    return {
      status: 'review-needed',
      reason: actor
        ? 'The subject exists, but the verified public-figure policy is not ready for automatic proof issuance.'
        : 'The subject is not present in the civic seed.',
    }
  }

  return {
    status: 'review-needed',
    reason: 'The adapter only resolves the PARA-backed civic claims requested in this milestone.',
  }
}
