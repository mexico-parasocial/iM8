import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  type ProofBrokerClaimType,
  type ProofBrokerParaProviderStatus,
  type ProofBrokerProofOutcome,
} from '../../src/contracts/proofBroker.ts'
import {
  findSeedActor,
  findTrustedVerificationRecord,
  loadParaCivicSeedManifest,
  type ParaCivicSeedManifest,
  type ParaSeedActor,
} from './paraSeed.ts'

export type ParaReadDisposition = 'verified' | 'bounded' | 'review-needed' | 'unavailable' | 'not-verified'

export type ParaPolicyState = {
  source: 'com.para.identity'
  status: 'present' | 'missing' | 'unavailable'
  isVerifiedPublicFigure: boolean
  proofBlob: string | null
  verifiedAt: string | null
}

export type ParaCompatibilityState = {
  source: 'app.bsky.graph.verification'
  status: 'ready' | 'needs-review' | 'missing' | 'unavailable'
  trustedVerifierAlias: string | null
  recordKey: string | null
  recordCreatedAt: string | null
}

export type ParaIdentityResolution = {
  subject: string
  actor: ParaSeedActor | null
  policy: ParaPolicyState
  compatibility: ParaCompatibilityState
  notes: string
}

export type ParaClaimVerificationResult = {
  claimType: ProofBrokerClaimType
  subject: string
  disposition: ParaReadDisposition
  outcome: ProofBrokerProofOutcome | null
  requestedValue: string | null
  policy: ParaPolicyState
  compatibility: ParaCompatibilityState
  statement: string
  reference: string | null
  notes: string
  evaluatedAt: string
}

export type PartyAffiliationFixture = {
  subjects: Array<{
    subject: string
    boundedValue: string
    statement: string
    reference: string
  }>
}

const PARTY_FIXTURE_CANDIDATES = [
  '/Users/mlv/Desktop/m8/iM8/server/providers/fixtures/partyAffiliation.json',
  '/Users/mlv/Desktop/m8/iM8/server/providers/partyAffiliation.json',
]

export { PARTY_FIXTURE_CANDIDATES }

function nowIso() {
  return new Date().toISOString()
}

function normalizeLookupKey(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}

async function optionalReadText(candidatePaths: string[]) {
  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath)
      return await readFile(candidatePath, 'utf8')
    } catch {
      continue
    }
  }

  return null
}

async function loadPartyAffiliationFixture(): Promise<PartyAffiliationFixture | null> {
  const raw = await optionalReadText(PARTY_FIXTURE_CANDIDATES)
  if (!raw) return null

  const parsed = JSON.parse(raw) as Partial<PartyAffiliationFixture>
  return {
    subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
  }
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values.filter(Boolean).map((value) => new Date(value as string).getTime())
  const newest = timestamps.length > 0 ? Math.max(...timestamps) : Number.NaN
  return Number.isNaN(newest) ? null : new Date(newest).toISOString()
}

function buildPolicyState(
  manifest: ParaCivicSeedManifest,
  actor: ParaSeedActor | null,
  trustedRecord: ReturnType<typeof findTrustedVerificationRecord>
): ParaPolicyState {
  if (!actor) {
    return {
      source: 'com.para.identity',
      status: 'missing',
      isVerifiedPublicFigure: false,
      proofBlob: null,
      verifiedAt: null,
    }
  }

  const identity = actor.identity ?? null

  if (!identity?.isVerifiedPublicFigure) {
    return {
      source: 'com.para.identity',
      status: 'present',
      isVerifiedPublicFigure: false,
      proofBlob: null,
      verifiedAt: identity?.verifiedAt ?? null,
    }
  }

  return {
    source: 'com.para.identity',
    status: 'present',
    isVerifiedPublicFigure: true,
    proofBlob: identity.proofBlob,
    verifiedAt: identity.verifiedAt,
  }
}

function buildCompatibilityState(
  trustedRecord: ReturnType<typeof findTrustedVerificationRecord> | null
): ParaCompatibilityState {
  if (!trustedRecord) {
    return {
      source: 'app.bsky.graph.verification',
      status: 'needs-review',
      trustedVerifierAlias: null,
      recordKey: null,
      recordCreatedAt: null,
    }
  }

  return {
    source: 'app.bsky.graph.verification',
    status: 'ready',
    trustedVerifierAlias: trustedRecord.issuer?.alias ?? null,
    recordKey: trustedRecord.record.rkey,
    recordCreatedAt: trustedRecord.record.createdAt,
  }
}

export async function resolveParaIdentityResolution(
  subject: string,
  manifest?: ParaCivicSeedManifest
): Promise<ParaIdentityResolution> {
  const resolvedManifest = manifest ?? (await loadParaCivicSeedManifest())
  const actor = findSeedActor(resolvedManifest, subject) ?? null
  const trustedRecord = findTrustedVerificationRecord(resolvedManifest, subject)
  const policy = buildPolicyState(resolvedManifest, actor, trustedRecord)
  const compatibility = buildCompatibilityState(trustedRecord)

  let notes = 'PARA seed loaded from com.para.identity and verification compatibility.'
  if (!actor) {
    notes = `No civic seed actor matched "${subject}".`
  } else if (!policy.isVerifiedPublicFigure) {
    notes = `Actor "${actor.alias}" exists but has no verified public-figure policy in com.para.identity.`
  } else if (!trustedRecord) {
    notes = `Actor "${actor.alias}" has public-figure policy, but no trusted app.bsky.graph.verification bridge was found.`
  }

  return {
    subject,
    actor,
    policy,
    compatibility,
    notes,
  }
}

function buildUnsupportedResult(
  claimType: ProofBrokerClaimType,
  subject: string,
  requestedValue: string | undefined,
  policy: ParaPolicyState,
  compatibility: ParaCompatibilityState,
  notes: string
): ParaClaimVerificationResult {
  return {
    claimType,
    subject,
    disposition: 'review-needed',
    outcome: null,
    requestedValue: requestedValue ?? null,
    policy,
    compatibility,
    statement: 'The claim cannot be safely resolved from the current PARA seed state.',
    reference: null,
    notes,
    evaluatedAt: nowIso(),
  }
}

async function resolvePartyAffiliationFixture(subject: string) {
  const fixture = await loadPartyAffiliationFixture()
  if (!fixture) return null

  const lookup = normalizeLookupKey(subject)
  return fixture.subjects.find((entry) => normalizeLookupKey(entry.subject) === lookup) ?? null
}

export async function verifyParaClaimFromSeed(
  input: {
    subject: string
    claimType: ProofBrokerClaimType
    requestedValue?: string
    audienceAppId: string
    audienceAppName: string
    reason: string
  },
  manifest?: ParaCivicSeedManifest
): Promise<ParaClaimVerificationResult> {
  const resolvedManifest = manifest ?? (await loadParaCivicSeedManifest())
  const resolution = await resolveParaIdentityResolution(input.subject, resolvedManifest)
  const { actor, policy, compatibility } = resolution

  if (input.claimType === 'has_party_affiliation_match') {
    const partyMatch = await resolvePartyAffiliationFixture(input.subject)
    if (!partyMatch) {
      return buildUnsupportedResult(
        input.claimType,
        input.subject,
        input.requestedValue,
        policy,
        compatibility,
        'No local party-affiliation fixture was found, so the adapter cannot invent a match.'
      )
    }

    return {
      claimType: input.claimType,
      subject: input.subject,
      disposition: 'bounded',
      outcome: 'bounded',
      requestedValue: input.requestedValue ?? partyMatch.boundedValue,
      policy,
      compatibility,
      statement: partyMatch.statement,
      reference: partyMatch.reference,
      notes: `Bounded match resolved for ${partyMatch.boundedValue}.`,
      evaluatedAt: nowIso(),
    }
  }

  if (input.claimType === 'has_para_verification') {
    if (!actor) {
      return buildUnsupportedResult(
        input.claimType,
        input.subject,
        input.requestedValue,
        policy,
        compatibility,
        'The subject is not present in the civic seed, so verification is unavailable.'
      )
    }

    if (policy.isVerifiedPublicFigure && compatibility.status === 'ready') {
      return {
        claimType: input.claimType,
        subject: input.subject,
        disposition: 'verified',
        outcome: 'verified',
        requestedValue: input.requestedValue ?? null,
        policy,
        compatibility,
        statement: 'PARA verification is present and bridged into a trusted compatibility record.',
        reference: compatibility.recordKey,
        notes: resolution.notes,
        evaluatedAt: nowIso(),
      }
    }

    return buildUnsupportedResult(
      input.claimType,
      input.subject,
      input.requestedValue,
      policy,
      compatibility,
      resolution.notes
    )
  }

  if (input.claimType === 'is_verified_public_figure' || input.claimType === 'is_civic_eligible') {
    if (!actor) {
      return buildUnsupportedResult(
        input.claimType,
        input.subject,
        input.requestedValue,
        policy,
        compatibility,
        'No subject match was found in the civic seed.'
      )
    }

    if (policy.isVerifiedPublicFigure && compatibility.status === 'ready') {
      return {
        claimType: input.claimType,
        subject: input.subject,
        disposition: 'verified',
        outcome: 'verified',
        requestedValue: input.requestedValue ?? null,
        policy,
        compatibility,
        statement:
          input.claimType === 'is_verified_public_figure'
            ? 'com.para.identity marks this account as a verified public figure.'
            : 'The verified public-figure policy is present, so the civic eligibility check passes.',
        reference: policy.proofBlob ?? compatibility.recordKey,
        notes: resolution.notes,
        evaluatedAt: nowIso(),
      }
    }

    return buildUnsupportedResult(
      input.claimType,
      input.subject,
      input.requestedValue,
      policy,
      compatibility,
      resolution.notes
    )
  }

  if (input.claimType === 'is_age_eligible') {
    return buildUnsupportedResult(
      input.claimType,
      input.subject,
      input.requestedValue,
      policy,
      compatibility,
      'Age eligibility is not represented in the PARA civic seed manifest.'
    )
  }

  return buildUnsupportedResult(
    input.claimType,
    input.subject,
    input.requestedValue,
    policy,
    compatibility,
    'The adapter only resolves the PARA-backed civic claims requested in this milestone.'
  )
}

export async function resolveParaProviderStatus(
  manifest?: ParaCivicSeedManifest
): Promise<ProofBrokerParaProviderStatus> {
  const resolvedManifest = manifest ?? (await loadParaCivicSeedManifest())
  const verifier = resolvedManifest.actors.find((actor) => actor.roles?.includes('verifier'))
  const verificationRecords = resolvedManifest.verificationRecords
  const trustedVerificationCount = verificationRecords.filter((record) =>
    Boolean(findSeedActor(resolvedManifest, record.subject)?.identity?.isVerifiedPublicFigure)
  ).length
  const supportedClaims: ProofBrokerClaimType[] = [
    'is_verified_public_figure',
    'is_civic_eligible',
    'has_para_verification',
    'has_party_affiliation_match',
  ]

  const lastSyncAt =
    latestTimestamp([
      ...verificationRecords.map((record) => record.createdAt),
      ...resolvedManifest.actors.flatMap((actor) => [
        actor.identity?.verifiedAt ?? null,
        actor.identity?.createdAt ?? null,
      ]),
    ]) ?? new Date().toISOString()

  return {
    providerId: 'para.identity',
    displayName: verifier?.displayName ?? 'PARA Trust MX',
    availability: resolvedManifest.actors.length > 0 ? 'online' : 'offline',
    compatibility:
      verificationRecords.length > 0 && trustedVerificationCount > 0 ? 'ready' : 'needs-review',
    policyRecord: 'com.para.identity',
    compatibilityRecord: 'app.bsky.graph.verification',
    lastSyncAt,
    supportedClaims,
    notes:
      verificationRecords.length > 0
        ? `${trustedVerificationCount} trusted verification record(s) available from the civic seed manifest.`
        : 'No trusted compatibility records were found in the civic seed manifest.',
  }
}
