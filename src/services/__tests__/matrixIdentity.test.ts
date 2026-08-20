import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hexToBytes } from '@noble/curves/abstract/utils'
import { deriveAllIdentities, IDENTITY_INDEXES } from '../keyDerivation'
import {
  BALLOT_IDENTITY_LABEL,
  MATRIX_IDENTITY_LABELS,
  MatrixIdentityForbiddenError,
  base32LowerNoPad,
  getMatrixIdentity,
  matrixIdentityFor,
  matrixLocalpart,
} from '../matrixIdentity'

/*
 * Two things are being tested here, and they fail for different reasons.
 *
 * 1. The derivation is pinned. MXIDs are account names on a live homeserver:
 *    if the formula drifts, every existing user silently becomes a different
 *    person. Treat a pin failure the way keyDerivation.test.ts does — fix the
 *    code, not the expectation, unless the spec version was deliberately
 *    bumped.
 *
 * 2. The identity boundary holds. This is the CI suite the Matrix v2 plan §3.2
 *    calls for: the ballot identity must never obtain a Matrix account, and
 *    nothing this module returns may be able to sign as an identity.
 */

const SERVER = 'matrix.para.social'

const here = dirname(fileURLToPath(import.meta.url))
const vectors = JSON.parse(
  readFileSync(join(here, 'identity-derivation-vectors.json'), 'utf8'),
).vectors as Array<{ seed: string }>

/** Pinned from the shared derivation vectors. See the note above. */
const LOCALPART_VECTORS: Record<string, { public: string; anonymous: string }> =
  {
    '0000000000000000000000000000000000000000000000000000000000000000': {
      public: 'k4o2lmcmitomgymtdb7y3htsthoofobo',
      anonymous: 'tksdt6ou5rbvxzeegiriy25u24pft5gz',
    },
    '0101010101010101010101010101010101010101010101010101010101010101': {
      public: '4hyygdnabmal525vs4ngqdcja7rxihxu',
      anonymous: 'cdx6xbqfawx7sqwpyvapwhwfvfu45l6f',
    },
    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08': {
      public: 'vrj6nj2ieu5vcj77lyfa3zskcvtkftly',
      anonymous: 'uvbbhlafnltimfcsy7mlsptwdsasrt6y',
    },
  }

describe('base32LowerNoPad', () => {
  // RFC 4648 §10 test vectors, lowercased with padding stripped.
  const rfc4648: Array<[string, string]> = [
    ['', ''],
    ['f', 'my'],
    ['fo', 'mzxq'],
    ['foo', 'mzxw6'],
    ['foob', 'mzxw6yq'],
    ['fooba', 'mzxw6ytb'],
    ['foobar', 'mzxw6ytboi'],
  ]

  for (const [input, expected] of rfc4648) {
    it(`encodes ${JSON.stringify(input)} as ${JSON.stringify(expected)}`, () => {
      assert.equal(
        base32LowerNoPad(new TextEncoder().encode(input)),
        expected,
      )
    })
  }
})

describe('matrixLocalpart', () => {
  it('rejects anything that is not a 32-byte public key', () => {
    assert.throws(() => matrixLocalpart(new Uint8Array(31)), /32 bytes/)
    assert.throws(() => matrixLocalpart(new Uint8Array(33)), /32 bytes/)
  })

  it('produces a localpart the Matrix grammar accepts', () => {
    for (const vector of vectors) {
      const identities = deriveAllIdentities(hexToBytes(vector.seed))
      for (const label of MATRIX_IDENTITY_LABELS) {
        const localpart = matrixLocalpart(identities[label].pub)
        // Historical user-ID grammar allows [a-z0-9._=/+-]; base32 output is a
        // strict subset of that. Uppercase here would mean invalid MXIDs.
        assert.match(localpart, /^[a-z2-7]{32}$/)
      }
    }
  })
})

describe('getMatrixIdentity — derivation', () => {
  it('matches the pinned localparts for the shared seed vectors', () => {
    for (const vector of vectors) {
      const expected = LOCALPART_VECTORS[vector.seed]
      assert.ok(expected, `no pinned localpart for seed ${vector.seed}`)
      const seed = hexToBytes(vector.seed)

      for (const label of MATRIX_IDENTITY_LABELS) {
        const identity = getMatrixIdentity(seed, label, SERVER)
        assert.equal(identity.localpart, expected[label])
        assert.equal(identity.mxid, `@${expected[label]}:${SERVER}`)
        assert.equal(identity.index, IDENTITY_INDEXES[label])
        assert.equal(identity.label, label)
      }
    }
  })

  it('is a pure function of the identity public key', () => {
    // Same key, reached two different ways, must give the same MXID: this is
    // what lets the server hold no mapping table at all.
    const seed = hexToBytes(vectors[0].seed)
    const identities = deriveAllIdentities(seed)
    assert.deepEqual(
      getMatrixIdentity(seed, 'public', SERVER),
      matrixIdentityFor(identities.public, SERVER),
    )
  })

  it('requires a server name', () => {
    assert.throws(
      () => getMatrixIdentity(hexToBytes(vectors[0].seed), 'public', ''),
      /serverName is required/,
    )
  })
})

describe('identity boundary (Matrix v2 §3.2)', () => {
  it('refuses the ballot identity', () => {
    for (const vector of vectors) {
      assert.throws(
        () =>
          getMatrixIdentity(
            hexToBytes(vector.seed),
            BALLOT_IDENTITY_LABEL,
            SERVER,
          ),
        MatrixIdentityForbiddenError,
      )
    }
  })

  it('refuses the ballot identity even when it is already derived', () => {
    // The bypass that matters: a caller holding a DerivedIdentity should not
    // be able to route around the label check by taking the other entry point.
    const identities = deriveAllIdentities(hexToBytes(vectors[0].seed))
    assert.throws(
      () => matrixIdentityFor(identities[BALLOT_IDENTITY_LABEL], SERVER),
      MatrixIdentityForbiddenError,
    )
  })

  it('keeps the ballot identity out of the allowlist', () => {
    // Guards the naming trap documented in matrixIdentity.ts: `civic` is the
    // ballot identity, not the community one.
    assert.equal(BALLOT_IDENTITY_LABEL, 'civic')
    assert.ok(
      !(MATRIX_IDENTITY_LABELS as readonly string[]).includes(
        BALLOT_IDENTITY_LABEL,
      ),
    )
    assert.equal(IDENTITY_INDEXES[BALLOT_IDENTITY_LABEL], 1)
  })

  it('refuses unknown and reserved identity labels by default', () => {
    // The derivation spec reserves indexes >= 3. An identity added later must
    // be refused until it is explicitly allowlisted.
    const seed = hexToBytes(vectors[0].seed)
    for (const label of ['delegate', 'burner', '', 'Public']) {
      assert.throws(
        () => getMatrixIdentity(seed, label as never, SERVER),
        MatrixIdentityForbiddenError,
      )
    }
  })

  it('never exposes private key material', () => {
    // Nothing downstream of this module should be able to sign as an identity.
    const seed = hexToBytes(vectors[0].seed)
    const identities = deriveAllIdentities(seed)

    for (const label of MATRIX_IDENTITY_LABELS) {
      const identity = getMatrixIdentity(seed, label, SERVER)
      const serialized = JSON.stringify(identity)

      assert.deepEqual(Object.keys(identity).sort(), [
        'identityPubHex',
        'index',
        'label',
        'localpart',
        'mxid',
      ])
      assert.ok(!('priv' in identity))
      assert.ok(
        !serialized.includes(identities[label].priv.toString(16)),
        'private scalar leaked into the Matrix identity',
      )
    }
  })

  it('does not let one identity be recognised from another', () => {
    // Separate MXIDs per identity is what stops a homeserver admin correlating
    // a user's public and community presence (plan §7).
    const seen = new Map<string, string>()
    for (const vector of vectors) {
      const seed = hexToBytes(vector.seed)
      for (const label of MATRIX_IDENTITY_LABELS) {
        const { mxid } = getMatrixIdentity(seed, label, SERVER)
        const previous = seen.get(mxid)
        assert.equal(
          previous,
          undefined,
          `MXID collision between ${previous} and ${vector.seed}/${label}`,
        )
        seen.set(mxid, `${vector.seed}/${label}`)
      }
    }
    assert.equal(seen.size, vectors.length * MATRIX_IDENTITY_LABELS.length)
  })
})
