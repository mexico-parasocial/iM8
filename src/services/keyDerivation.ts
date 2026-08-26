import { sha512 } from '@noble/hashes/sha2'
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils'
import { RistrettoPoint, ed25519 } from '@noble/curves/ed25519'
import { bytesToNumberLE, numberToBytesLE, bytesToHex } from '@noble/curves/abstract/utils'
import { entropyToMnemonic, generateMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

/*
 * Client implementation of the PARA identity derivation spec, v1.
 * Normative spec and shared test vectors live in mubEZ:
 *   docs/IDENTITY_DERIVATION.md
 *   docs/identity-derivation-vectors.json (copied to __tests__/ here)
 *
 * This module is pure math: no React Native imports, no storage, no
 * randomness. Seed generation and custody live in seedVault.ts. Keeping it
 * pure is what lets the vector tests run under node:test and guarantees the
 * client derives byte-identical keys to the reference implementation.
 */

const L = ed25519.CURVE.n

export const DOMAIN_SPEND = 'm8/derive/spend/v1'
export const DOMAIN_VIEW = 'm8/derive/view/v1'
export const DOMAIN_IDENTITY = 'para-id/v1'
/*
 * Separate domain for cards past the first. Card 0 keeps deriving under
 * DOMAIN_IDENTITY so it stays byte-identical to spec v1 and the shared
 * vectors in mubEZ continue to pass unchanged.
 */
export const DOMAIN_CARD = 'para-id/card/v1'

export const IDENTITY_INDEXES = {
  public: 0,
  civic: 1,
  anonymous: 2,
} as const

export type IdentityLabel = keyof typeof IDENTITY_INDEXES

/** H_s: SHA-512 interpreted little-endian, reduced mod the group order l. */
export function hashToScalar(...parts: Uint8Array[]): bigint {
  return bytesToNumberLE(sha512(concatBytes(...parts))) % L
}

function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])
}

export interface MasterKeys {
  spendPriv: bigint
  viewPriv: bigint
  spendPub: Uint8Array
}

export function deriveMasterKeys(seed: Uint8Array): MasterKeys {
  if (seed.length !== 32) {
    throw new Error('seed must be exactly 32 bytes')
  }
  const spendPriv = hashToScalar(utf8ToBytes(DOMAIN_SPEND), seed)
  const viewPriv = hashToScalar(utf8ToBytes(DOMAIN_VIEW), seed)
  const spendPub = RistrettoPoint.BASE.multiply(spendPriv).toRawBytes()
  return { spendPriv, viewPriv, spendPub }
}

export interface DerivedIdentity {
  index: number
  label: IdentityLabel
  /** Which card under this label; 0 is the label's primary identity. */
  card: number
  priv: bigint
  /** 32-byte ristretto255 encoding; the only thing that ever reaches a server. */
  pub: Uint8Array
  pubHex: string
}

/**
 * Derive one identity key.
 *
 * `card` distinguishes several independent identities under the same label.
 * The product lets a user hold more than one anonymous card and tells them the
 * cards are not linked — with a single key per label that promise is only
 * skin-deep, since both cards would sign with the same key and anyone holding
 * a signature from each could join them in one step. A per-card tweak makes
 * the separation real.
 *
 * Card 0 derives exactly as spec v1 did, so existing identities and the shared
 * mubEZ vectors are unaffected: the first card of a label *is* the v1 identity.
 *
 * Unlinkability here is against outside observers. Anyone holding the view key
 * can still enumerate every card — that is what the view key is for.
 */
export function deriveIdentity(
  keys: MasterKeys,
  label: IdentityLabel,
  card = 0,
): DerivedIdentity {
  if (!Number.isInteger(card) || card < 0) {
    throw new Error('card must be a non-negative integer')
  }

  const index = IDENTITY_INDEXES[label]
  const tweak =
    card === 0
      ? hashToScalar(
          utf8ToBytes(DOMAIN_IDENTITY),
          numberToBytesLE(keys.viewPriv, 32),
          u32le(index),
        )
      : hashToScalar(
          utf8ToBytes(DOMAIN_CARD),
          numberToBytesLE(keys.viewPriv, 32),
          u32le(index),
          u32le(card),
        )
  const priv = (keys.spendPriv + tweak) % L
  const pub = RistrettoPoint.BASE.multiply(priv).toRawBytes()
  return { index, label, card, priv, pub, pubHex: bytesToHex(pub) }
}

export function deriveAllIdentities(seed: Uint8Array): Record<IdentityLabel, DerivedIdentity> {
  const keys = deriveMasterKeys(seed)
  return {
    public: deriveIdentity(keys, 'public'),
    civic: deriveIdentity(keys, 'civic'),
    anonymous: deriveIdentity(keys, 'anonymous'),
  }
}

/*
 * Backup encoding: the 32-byte seed IS the BIP-39 entropy, so the 24-word
 * mnemonic round-trips to the exact seed (no PBKDF2 stretching - the seed is
 * already full-entropy, and stretching would break vector compatibility).
 */

export function seedToMnemonic(seed: Uint8Array): string {
  if (seed.length !== 32) {
    throw new Error('seed must be exactly 32 bytes')
  }
  return entropyToMnemonic(seed, wordlist)
}

export function mnemonicToSeed(mnemonic: string): Uint8Array {
  const normalized = mnemonic.trim().toLowerCase().split(/\s+/).join(' ')
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('invalid mnemonic')
  }
  const entropy = mnemonicToEntropy(normalized, wordlist)
  if (entropy.length !== 32) {
    throw new Error('mnemonic must encode a 32-byte seed (24 words)')
  }
  return entropy
}

export function isValidMnemonic(mnemonic: string): boolean {
  try {
    mnemonicToSeed(mnemonic)
    return true
  } catch {
    return false
  }
}

/** Re-exported so callers can generate mnemonics without touching bip39 directly. */
export { generateMnemonic, wordlist }
