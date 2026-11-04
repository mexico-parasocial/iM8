import { base58 } from '@scure/base'
import { RistrettoPoint } from '@noble/curves/ed25519'
import { concatBytes, hexToBytes } from '@noble/curves/abstract/utils'

/*
 * did:key encoding for PARA identity public keys.
 *
 * did:key is `did:key:` + multibase(multicodec(key)): a `z` (base58btc)
 * prefix, then base58btc over the unsigned-varint multicodec code followed by
 * the raw public key bytes.
 *
 * identity_pub_i is a ristretto255 point and is used directly as an sr25519
 * public key (mubEZ docs/CRYPTO_DECISIONS.md CD-2, CD-7). The multicodec table
 * registers `sr25519-pub` as 0xef (status: draft), which varint-encodes as
 * [0xef, 0x01]. The DID therefore says exactly what the key is: an sr25519
 * public key, verifiable as such.
 *
 * Any did:key parser that follows multibase + multicodec recovers
 * (0xef, 32-byte key) from this. Building a full DID Document needs a
 * verification-method type for the codec, and the did:key spec lists types
 * only for some codecs; sr25519 is not among them. A generic resolver may
 * therefore parse the identifier and still report the key type as unsupported.
 * That means it lacks an sr25519 verifier. The identifier is still well-formed.
 *
 * Pure: no React Native imports, so it is testable under node:test.
 */

/** Multicodec code for `sr25519-pub` (multiformats/multicodec table.csv). */
export const SR25519_PUB_MULTICODEC = 0xef

/** unsigned-varint(0xef): low 7 bits with continuation bit, then the rest. */
const SR25519_PUB_PREFIX = Uint8Array.of(0xef, 0x01)

const SR25519_PUB_LENGTH = 32
const DID_KEY_PREFIX = 'did:key:'
const MULTIBASE_BASE58BTC = 'z'

/** did:key for a 32-byte sr25519 / ristretto255 public key. */
export function didKeyForSr25519PublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== SR25519_PUB_LENGTH) {
    throw new Error(`sr25519 public key must be ${SR25519_PUB_LENGTH} bytes, got ${publicKey.length}`)
  }
  // Rejects anything that is not a canonical ristretto255 encoding, so a
  // malformed key can never be published under a well-formed DID.
  RistrettoPoint.fromHex(publicKey)
  return `${DID_KEY_PREFIX}${MULTIBASE_BASE58BTC}${base58.encode(concatBytes(SR25519_PUB_PREFIX, publicKey))}`
}

/** did:key for a hex-encoded identity public key (keyDerivation's `pubHex`). */
export function didKeyForSr25519PublicKeyHex(pubHex: string): string {
  return didKeyForSr25519PublicKey(hexToBytes(pubHex))
}

/**
 * The sr25519 public key a did:key names. Throws if the DID is not a did:key,
 * is not base58btc, or does not carry the sr25519-pub multicodec.
 */
export function sr25519PublicKeyFromDidKey(did: string): Uint8Array {
  if (!did.startsWith(DID_KEY_PREFIX)) throw new Error('not a did:key')
  const multibase = did.slice(DID_KEY_PREFIX.length)
  if (multibase[0] !== MULTIBASE_BASE58BTC) throw new Error('did:key must use base58btc (z) multibase')
  const bytes = base58.decode(multibase.slice(1))
  if (
    bytes.length !== SR25519_PUB_PREFIX.length + SR25519_PUB_LENGTH ||
    bytes[0] !== SR25519_PUB_PREFIX[0] ||
    bytes[1] !== SR25519_PUB_PREFIX[1]
  ) {
    throw new Error('did:key does not carry an sr25519-pub (0xef) key')
  }
  const publicKey = bytes.slice(SR25519_PUB_PREFIX.length)
  RistrettoPoint.fromHex(publicKey)
  return publicKey
}

/**
 * The malformed form earlier builds wrote: `did:key:z` + 64 hex characters, with
 * no multicodec header. Hex is not base58btc (`0` is outside the alphabet), so
 * no did:key parser accepts it. No registered key type's did:key is exactly 64
 * characters after the `z`, so this shape is unambiguous.
 */
const LEGACY_HEX_DID_KEY = /^did:key:z([0-9a-f]{64})$/

/**
 * If `did` is in the legacy hex form, the correct did:key for the same key;
 * otherwise null. Lets persisted sessions be repaired without the seed, since
 * the legacy string already contains the whole public key.
 */
export function migrateLegacyIdentityDid(did: string): string | null {
  const match = LEGACY_HEX_DID_KEY.exec(did)
  if (!match) return null
  try {
    return didKeyForSr25519PublicKeyHex(match[1])
  } catch {
    // Not a valid ristretto255 point: not something this app ever wrote.
    return null
  }
}
