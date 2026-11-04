import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils'
import { base58btc } from 'multiformats/bases/base58'
import { varint } from 'multiformats'
import { deriveAllIdentities } from '../keyDerivation'
import {
  SR25519_PUB_MULTICODEC,
  didKeyForSr25519PublicKey,
  didKeyForSr25519PublicKeyHex,
  migrateLegacyIdentityDid,
  sr25519PublicKeyFromDidKey,
} from '../identityDid'

/*
 * The did:key for identity_pub_i is checked against `multiformats`, the
 * reference JS multibase/multicodec implementation, not against identityDid.ts
 * itself. If this module and that parser ever disagree, the module is wrong.
 */

const here = dirname(fileURLToPath(import.meta.url))
const derivationVectors = JSON.parse(
  readFileSync(join(here, 'identity-derivation-vectors.json'), 'utf8'),
).vectors as Array<{ seed: string; identities: Array<{ label: string; pub: string }> }>

/** Seed 0x00…00, label `public` (identity-derivation-vectors.json, vector 0). */
const VECTOR = {
  pubHex: '1ab9ade6921927de4d143926093f52d886a9ac724312daeac39b9da943833715',
  did: 'did:key:z6QNmokd3fLSPm5UdutpMxGaNH3b5ktPBds6DEbLuvwJTrPN',
  legacyDid: 'did:key:z1ab9ade6921927de4d143926093f52d886a9ac724312daeac39b9da943833715',
}

/** A spec-conformant did:key parse: multibase, then the multicodec varint. */
function parseDidKey(did: string): { code: number; key: Uint8Array } {
  assert.ok(did.startsWith('did:key:'), 'did:key method prefix')
  const bytes = base58btc.decode(did.slice('did:key:'.length))
  const [code, headerLength] = varint.decode(bytes)
  return { code, key: bytes.subarray(headerLength) }
}

/** Rebuild a did:key from parts with the reference implementation. */
function encodeDidKey(code: number, key: Uint8Array): string {
  const header = new Uint8Array(varint.encodingLength(code))
  varint.encodeTo(code, header)
  const bytes = new Uint8Array(header.length + key.length)
  bytes.set(header)
  bytes.set(key, header.length)
  return `did:key:${base58btc.encode(bytes)}`
}

describe('identity did:key', () => {
  it('pins the encoding for the public identity of the zero seed', () => {
    assert.equal(derivationVectors[0].identities.find((i) => i.label === 'public')?.pub, VECTOR.pubHex)
    assert.equal(didKeyForSr25519PublicKeyHex(VECTOR.pubHex), VECTOR.did)
  })

  it('is a did:key a standard parser accepts, naming an sr25519-pub key', () => {
    const parsed = parseDidKey(VECTOR.did)
    assert.equal(SR25519_PUB_MULTICODEC, 0xef)
    assert.equal(parsed.code, 0xef)
    assert.equal(bytesToHex(parsed.key), VECTOR.pubHex)
  })

  it('round-trips through the reference implementation for every vector identity', () => {
    for (const vector of derivationVectors) {
      for (const identity of Object.values(deriveAllIdentities(hexToBytes(vector.seed)))) {
        const did = didKeyForSr25519PublicKey(identity.pub)
        const parsed = parseDidKey(did)
        assert.equal(parsed.code, SR25519_PUB_MULTICODEC)
        assert.equal(bytesToHex(parsed.key), identity.pubHex)
        assert.equal(encodeDidKey(parsed.code, parsed.key), did)
        assert.equal(bytesToHex(sr25519PublicKeyFromDidKey(did)), identity.pubHex)
      }
    }
  })

  it('reads keys encoded by the reference implementation', () => {
    const did = encodeDidKey(0xef, hexToBytes(VECTOR.pubHex))
    assert.equal(did, VECTOR.did)
    assert.equal(bytesToHex(sr25519PublicKeyFromDidKey(did)), VECTOR.pubHex)
  })

  it('refuses a did:key for a different key type', () => {
    // Ed25519 (0xed) did:key, as used in profileFacets.test.ts.
    const ed25519Did = 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'
    assert.equal(parseDidKey(ed25519Did).code, 0xed)
    assert.throws(() => sr25519PublicKeyFromDidKey(ed25519Did), /sr25519-pub/)
  })

  it('refuses keys that are not canonical ristretto255 points', () => {
    assert.throws(() => didKeyForSr25519PublicKey(new Uint8Array(31)))
    assert.throws(() => didKeyForSr25519PublicKey(new Uint8Array(32).fill(0xff)))
  })
})

describe('legacy hex did:key migration', () => {
  it('the old form is rejected by a standard parser', () => {
    assert.throws(() => parseDidKey(VECTOR.legacyDid))
  })

  it('rewrites the old form to the correct did:key for the same key', () => {
    assert.equal(migrateLegacyIdentityDid(VECTOR.legacyDid), VECTOR.did)
  })

  it('leaves every other DID alone', () => {
    assert.equal(migrateLegacyIdentityDid(VECTOR.did), null)
    assert.equal(migrateLegacyIdentityDid('did:web:alice.m8.local'), null)
    assert.equal(migrateLegacyIdentityDid('did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'), null)
    // Hex-shaped, but not a ristretto255 point: not something the app wrote.
    assert.equal(migrateLegacyIdentityDid(`did:key:z${'ff'.repeat(32)}`), null)
  })
})
