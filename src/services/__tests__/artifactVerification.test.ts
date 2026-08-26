import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sign, getPublicKey } from '@scure/sr25519'
import { bytesToHex } from '@noble/curves/abstract/utils'

import {
  encodeArtifact,
  verifyProofArtifact,
  isTrustworthy,
} from '../artifactVerification'
import type { ProofBrokerProofArtifact } from '../../contracts/proofBroker'

// sr25519 secrets are 64 bytes: a cofactor-shifted key half plus a nonce half.
// These are throwaway test issuer keys, not derived identities.
function testIssuerSecret(fill: number): Uint8Array {
  const secret = new Uint8Array(64).fill(fill)
  // Clamp the key half the way the curve expects.
  secret[0] &= 0xf8
  secret[31] &= 0x3f
  secret[31] |= 0x40
  return secret
}

const issuerSecret = testIssuerSecret(11)
const issuerPub = bytesToHex(getPublicKey(issuerSecret))

const base: ProofBrokerProofArtifact = {
  id: 'art-1',
  grantId: 'grant-1',
  requestId: 'req-1',
  claimType: 'is_civic_eligible',
  requestedValue: null,
  outcome: 'verified',
  statement: 'Holder is civically eligible',
  proofMode: 'proof-only',
  issuerId: 'para.identity',
  verifierId: 'm8.broker',
  audienceAppId: 'apice',
  audienceAppName: 'Ápice',
  surface: 'civic',
  reference: 'ref-1',
  status: 'active',
  issuedAt: '2026-08-01T00:00:00Z',
  lastUsedAt: null,
  expiresAt: '2099-01-01T00:00:00Z',
  revokedAt: null,
}

function attest(artifact: ProofBrokerProofArtifact): ProofBrokerProofArtifact {
  const signature = bytesToHex(sign(issuerSecret, encodeArtifact(artifact)))
  return {
    ...artifact,
    attestation: { issuerPub, signature, alg: 'para.artifact.v1' },
  }
}

const opts = { trustedIssuers: [issuerPub], audienceAppId: 'apice' }

describe('proof artifact verification', () => {
  it('accepts a correctly signed artifact', () => {
    const result = verifyProofArtifact(attest(base), opts)
    assert.equal(result.status, 'verified')
    assert.ok(isTrustworthy(result))
  })

  it('reports an unsigned artifact as unverifiable, not as valid', () => {
    // This is today's real state: the broker does not sign yet. It must never
    // read as trustworthy just because `outcome` says "verified".
    const result = verifyProofArtifact(base, opts)
    assert.equal(result.status, 'unsigned')
    assert.ok(!isTrustworthy(result))
  })

  it('rejects a tampered statement even with a valid-looking signature', () => {
    const signed = attest(base)
    const tampered = { ...signed, statement: 'Holder is a party officer' }
    assert.equal(verifyProofArtifact(tampered, opts).status, 'bad-signature')
  })

  it('rejects a flipped outcome', () => {
    const signed = attest({ ...base, outcome: 'not-verified' })
    const flipped = { ...signed, outcome: 'verified' as const }
    assert.equal(verifyProofArtifact(flipped, opts).status, 'bad-signature')
  })

  it('rejects an artifact replayed to a different app', () => {
    const signed = attest({ ...base, audienceAppId: 'some-other-app' })
    const result = verifyProofArtifact(signed, opts)
    assert.equal(result.status, 'wrong-audience')
  })

  it('rejects an expired proof before checking anything cryptographic', () => {
    const signed = attest({ ...base, expiresAt: '2020-01-01T00:00:00Z' })
    assert.equal(verifyProofArtifact(signed, opts).status, 'expired')
  })

  it('rejects a revoked proof', () => {
    const signed = attest({ ...base, status: 'revoked' })
    assert.equal(verifyProofArtifact(signed, opts).status, 'revoked')
  })

  it('distinguishes an untrusted issuer from a bad signature', () => {
    const otherSecret = testIssuerSecret(22)
    const otherPub = bytesToHex(getPublicKey(otherSecret))
    const signature = bytesToHex(sign(otherSecret, encodeArtifact(base)))
    const signed: ProofBrokerProofArtifact = {
      ...base,
      attestation: { issuerPub: otherPub, signature, alg: 'para.artifact.v1' },
    }
    const result = verifyProofArtifact(signed, opts)
    assert.equal(result.status, 'untrusted-issuer')
  })

  it('rejects malformed attestations without throwing', () => {
    for (const attestation of [
      { issuerPub: 'zz', signature: 'zz', alg: 'para.artifact.v1' as const },
      { issuerPub, signature: 'short', alg: 'para.artifact.v1' as const },
      { issuerPub, signature: 'a'.repeat(128), alg: 'wrong' as never },
    ]) {
      const result = verifyProofArtifact({ ...base, attestation }, opts)
      assert.equal(result.status, 'malformed')
    }
  })

  it('survives garbage input', () => {
    for (const junk of [null, undefined, 'string', 42]) {
      const result = verifyProofArtifact(junk as never, opts)
      assert.ok(['malformed', 'wrong-audience'].includes(result.status))
    }
  })

  it('binds every meaning-carrying field', () => {
    // If a field can be edited after signing without breaking verification,
    // it was left out of the canonical encoding.
    const signed = attest(base)
    const mutations: Partial<ProofBrokerProofArtifact>[] = [
      { claimType: 'is_age_eligible' },
      { proofMode: 'raw' },
      { issuerId: 'm8.broker' },
      { surface: 'public' },
      { grantId: 'grant-2' },
      { issuedAt: '2026-01-01T00:00:00Z' },
    ]
    for (const patch of mutations) {
      const result = verifyProofArtifact({ ...signed, ...patch }, opts)
      assert.equal(
        result.status,
        'bad-signature',
        `field ${Object.keys(patch)[0]} is not covered by the signature`,
      )
    }
  })
})
