import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { verifyProofArtifact } from '../artifactVerification'
import type { ProofBrokerProofArtifact } from '../../contracts/proofBroker'

/**
 * Cross-repo contract test. The vector is a copy of
 * mubEZ/docs/artifact-attestation-vectors.json — the broker's published
 * attestation over a fixed artifact. If this test fails after a change on
 * either side, the canonical encoding or the signing scheme drifted and the
 * client can no longer verify what the broker signs.
 */

const vector = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'artifact-attestation-vectors.json'),
    'utf8',
  ),
) as {
  issuerPub: string
  artifact: ProofBrokerProofArtifact & { audienceAppId: string }
  attestation: { alg: 'para.artifact.v1'; issuerPub: string; signature: string }
}

describe('mubEZ published attestation vector', () => {
  const artifact: ProofBrokerProofArtifact = {
    ...vector.artifact,
    attestation: vector.attestation,
  }

  it('verifies as verified when the issuer is trusted', () => {
    const result = verifyProofArtifact(artifact, {
      trustedIssuers: [vector.issuerPub],
      audienceAppId: artifact.audienceAppId,
      // expiresAt is null; now is irrelevant but explicit is better than ambient
      now: new Date('2026-08-23T00:00:00.000Z'),
    })
    assert.deepEqual(result, {
      status: 'verified',
      issuerPub: vector.issuerPub,
    })
  })

  it('is rejected as untrusted-issuer when the key was never pinned', () => {
    const result = verifyProofArtifact(artifact, {
      trustedIssuers: [],
      audienceAppId: artifact.audienceAppId,
    })
    assert.equal(result.status, 'untrusted-issuer')
  })

  it('breaks when the statement is edited after signing', () => {
    const tampered = {
      ...artifact,
      statement: `${artifact.statement} (edited)`,
    }
    const result = verifyProofArtifact(tampered, {
      trustedIssuers: [vector.issuerPub],
      audienceAppId: artifact.audienceAppId,
    })
    assert.equal(result.status, 'bad-signature')
  })

  it('breaks when the outcome is flipped after signing', () => {
    const tampered = { ...artifact, outcome: 'mismatched' as const }
    const result = verifyProofArtifact(tampered, {
      trustedIssuers: [vector.issuerPub],
      audienceAppId: artifact.audienceAppId,
    })
    assert.equal(result.status, 'bad-signature')
  })

  it('breaks when the artifact is replayed to another app', () => {
    const result = verifyProofArtifact(artifact, {
      trustedIssuers: [vector.issuerPub],
      audienceAppId: 'app.other.things',
    })
    assert.equal(result.status, 'wrong-audience')
  })
})
