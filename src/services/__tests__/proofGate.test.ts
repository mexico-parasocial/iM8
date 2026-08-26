import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  PARA_GATED_SPACES,
  gatedSimpleSpaceConfig,
  gatedSpaceFor,
  gateAudienceFor,
} from '../../contracts/gatedSpaces'
import type { ProofBrokerClaimType } from '../../contracts/proofBroker'
import { evaluateProofGate } from '../proofGate'
import { formatSpaceUri } from '../atproto/spaceClient'
import type { ClaimType, ProofArtifact } from '../../types'

const spaceUri = 'at://did:plc:community/space/com.para.space.civic/main'

function artifact(
  claimType: ClaimType,
  overrides: Partial<Pick<ProofArtifact, 'status' | 'audienceAppId' | 'verification'>> = {}
): ProofArtifact {
  return {
    id: `art-${claimType}`,
    claimType,
    label: claimType,
    issuer: 'para.identity',
    verifier: 'm8.broker',
    audienceAppId: spaceUri,
    proofRef: 'ref',
    summary: 'summary',
    issuedAt: '2026-08-01T00:00:00Z',
    expiresAt: '2099-01-01T00:00:00Z',
    status: 'Active',
    ...overrides,
  }
}

const verified = { status: 'verified' as const, issuerPub: 'a'.repeat(64) }

describe('gated space catalog', () => {
  it('ships one spec per PARA space type with non-empty requirements', () => {
    assert.equal(PARA_GATED_SPACES.length, 3)
    const types = PARA_GATED_SPACES.map((spec) => spec.spaceType)
    assert.equal(new Set(types).size, types.length)
    for (const spec of PARA_GATED_SPACES) {
      assert.ok(spec.requiredClaims.length > 0, `${spec.spaceType} demands nothing`)
    }
  })

  it('builds the space id and managing-app config for a community authority', () => {
    const civic = PARA_GATED_SPACES[0]
    const space = gatedSpaceFor(civic, 'did:plc:community')
    assert.equal(formatSpaceUri(space), spaceUri)
    const config = gatedSimpleSpaceConfig(civic, 'did:plc:mubez')
    assert.deepEqual(config, {
      policy: 'managing-app',
      appAccess: { type: 'open' },
      managingApp: 'did:plc:mubez',
    })
  })

  it('uses the space URI itself as the gate audience', () => {
    assert.equal(gateAudienceFor(spaceUri), spaceUri)
  })
})

describe('proof gate evaluation', () => {
  it('admits when every required claim has an active, audience-bound, verified artifact', () => {
    const evaluation = evaluateProofGate({
      requiredClaims: ['is_civic_eligible', 'is_age_eligible'],
      artifacts: [
        artifact('is_civic_eligible', { verification: verified }),
        artifact('is_age_eligible', { verification: verified }),
      ],
      audience: spaceUri,
    })
    assert.equal(evaluation.admitted, true)
    assert.deepEqual(evaluation.claims, [
      { claimType: 'is_civic_eligible', state: 'satisfied' },
      { claimType: 'is_age_eligible', state: 'satisfied' },
    ])
  })

  it('reports claims with no artifacts as missing', () => {
    const evaluation = evaluateProofGate({
      requiredClaims: ['is_civic_eligible', 'is_age_eligible'],
      artifacts: [artifact('is_civic_eligible', { verification: verified })],
      audience: spaceUri,
    })
    assert.equal(evaluation.admitted, false)
    assert.deepEqual(evaluation.claims[1], { claimType: 'is_age_eligible', state: 'missing' })
  })

  it('reports active artifacts that were never verified as not-checked, not satisfied', () => {
    const evaluation = evaluateProofGate({
      requiredClaims: ['is_age_eligible' as ProofBrokerClaimType],
      artifacts: [artifact('is_age_eligible')],
      audience: spaceUri,
    })
    assert.equal(evaluation.admitted, false)
    assert.deepEqual(evaluation.claims[0], {
      claimType: 'is_age_eligible',
      state: 'unverified',
      reason: 'not-checked',
    })
  })

  it('surfaces the verification status as the reason when the check ran', () => {
    const evaluation = evaluateProofGate({
      requiredClaims: ['is_age_eligible'],
      artifacts: [artifact('is_age_eligible', { verification: { status: 'unsigned' } })],
      audience: spaceUri,
    })
    assert.deepEqual(evaluation.claims[0], {
      claimType: 'is_age_eligible',
      state: 'unverified',
      reason: 'unsigned',
    })
  })

  it('calls out artifacts minted for a different audience as wrong-audience', () => {
    const evaluation = evaluateProofGate({
      requiredClaims: ['is_age_eligible'],
      artifacts: [artifact('is_age_eligible', { audienceAppId: 'apice' })],
      audience: spaceUri,
    })
    assert.deepEqual(evaluation.claims[0], {
      claimType: 'is_age_eligible',
      state: 'unverified',
      reason: 'wrong-audience',
    })
  })

  it('calls out revoked or expired artifacts by lifecycle', () => {
    const revoked = evaluateProofGate({
      requiredClaims: ['is_age_eligible'],
      artifacts: [artifact('is_age_eligible', { status: 'Revoked', verification: verified })],
      audience: spaceUri,
    })
    assert.deepEqual(revoked.claims[0], {
      claimType: 'is_age_eligible',
      state: 'unverified',
      reason: 'artifact-revoked',
    })
  })

  it('one good artifact satisfies a claim even when a sibling fails', () => {
    const evaluation = evaluateProofGate({
      requiredClaims: ['is_age_eligible'],
      artifacts: [
        artifact('is_age_eligible', { status: 'Expired' }),
        artifact('is_age_eligible', { verification: verified }),
      ],
      audience: spaceUri,
    })
    assert.equal(evaluation.admitted, true)
  })
})
