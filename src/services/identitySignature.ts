import { sha512 } from '@noble/hashes/sha2'
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils'
import {
  bytesToHex,
  bytesToNumberLE,
  numberToBytesLE,
} from '@noble/curves/abstract/utils'
import { getPublicKey, sign, verify } from '@scure/sr25519'
import {
  deriveAllIdentities,
  type DerivedIdentity,
  type IdentityLabel,
} from './keyDerivation'
import {
  MATRIX_IDENTITY_LABELS,
  MatrixIdentityForbiddenError,
  isMatrixIdentityLabel,
} from './matrixIdentity'

/*
 * Proof of possession for PARA identity keys (OD-2 / CD-M4).
 * Spec and decision record: WatZappa/docs/OD-2-PROOF-OF-POSSESSION.md
 *
 * The client proves it holds identity_priv_i when asserting identity_pub_i to
 * para-idp. Without this, the MXID — a function of a PUBLIC key (CD-M1) —
 * could be claimed by anyone who learns that key.
 *
 * We do not implement Schnorr ourselves. sr25519 IS Schnorr over ristretto255,
 * and @scure/sr25519 is an audited implementation from the same author as
 * @noble/curves and @scure/bip39, both already relied on here. See the memo for
 * why an audited library mattered more than an elegant hand-rolled scheme.
 */

/** Domain separator. Versioned: changing it invalidates every signature. */
export const DOMAIN_IDENTITY_SIG = 'para-id/sig/v1'
const DOMAIN_SIG_NONCE = 'para-id/sig-nonce/v1'

/**
 * Purposes a signature may be issued for. A signature carries its purpose
 * inside the signed bytes, so a matrix-login assertion cannot be replayed as a
 * registration one. Monero's plain generate_signature has no domain separation
 * at all and leaves this to callers; its own proof code had to grow a versioned
 * HASH_KEY_TXPROOF_V2 constant to fix the resulting confusability. We start
 * where they ended up.
 */
export const SIG_PURPOSES = ['matrix-login', 'mubez-registration'] as const
export type SigPurpose = (typeof SIG_PURPOSES)[number]

const CURVE_ORDER =
  2n ** 252n + 27742317777372353535851937790883648493n
const SCALAR_MASK = 2n ** 256n - 1n

/**
 * sr25519 stores the key half of its 64-byte secret cofactor-shifted
 * (`scalar << 3`), mirroring schnorrkel's Ed25519-compatible format;
 * `getPublicKey` divides by 8 to recover the scalar. Injecting a raw scalar
 * here would silently produce the wrong public key, so this encoding is the
 * load-bearing detail of the whole module.
 *
 * Lossless for every scalar < the group order: `x << 3 < 2^255` fits the
 * 256-bit mask, so the shift never truncates.
 */
function encodeSecretScalar(scalar: bigint): Uint8Array {
  if (scalar <= 0n || scalar >= CURVE_ORDER) {
    throw new Error('scalar out of range')
  }
  return numberToBytesLE((scalar << 3n) & SCALAR_MASK, 32)
}

/**
 * The nonce half of the sr25519 secret. Derived deterministically from the
 * identity key so it is stable across devices restored from the same seed, and
 * domain-separated so it can never collide with a derivation tweak.
 *
 * Note this is the *stored* nonce seed, not the per-signature nonce: sign()
 * additionally mixes fresh randomness (see signIdentityChallenge), which is
 * what makes the scheme synthetic rather than purely deterministic.
 */
function deriveNonceSeed(scalar: bigint): Uint8Array {
  return sha512(
    concatBytes(utf8ToBytes(DOMAIN_SIG_NONCE), numberToBytesLE(scalar, 32)),
  ).subarray(0, 32)
}

/** The signed payload. Key order is canonical and must not be reordered. */
export interface IdentityAssertion {
  type: 'para.identity.pop.v1'
  purpose: SigPurpose
  audience: string
  identityPub: string
  challenge: string
  signedAt: string
}

/**
 * Canonical encoding of the payload. Field order is fixed by construction
 * rather than by JSON.stringify's key ordering, so a verifier in another
 * language cannot disagree with us about what was signed.
 */
export function encodeAssertion(a: IdentityAssertion): Uint8Array {
  return utf8ToBytes(
    [
      DOMAIN_IDENTITY_SIG,
      a.type,
      a.purpose,
      a.audience,
      a.identityPub,
      a.challenge,
      a.signedAt,
    ].join('\n'),
  )
}

export interface SignedAssertion {
  assertion: IdentityAssertion
  /** 64-byte sr25519 signature, hex. */
  signature: string
}

function secretKeyFor(identity: DerivedIdentity): Uint8Array {
  const secret = new Uint8Array(64)
  secret.set(encodeSecretScalar(identity.priv), 0)
  secret.set(deriveNonceSeed(identity.priv), 32)
  return secret
}

/**
 * Sign a challenge as the given identity.
 *
 * Refuses the ballot identity by the same allowlist as `getMatrixIdentity`.
 * This is the review point OD-2 §6 calls the most important one: the boundary
 * has to hold at the signing layer too, or it is bypassable one level below
 * the Matrix identity API.
 */
export function signIdentityChallenge(
  seed: Uint8Array,
  label: IdentityLabel,
  input: {
    purpose: SigPurpose
    audience: string
    challenge: string
    signedAt?: string
  },
  random?: Uint8Array,
): SignedAssertion {
  if (!isMatrixIdentityLabel(label)) {
    throw new MatrixIdentityForbiddenError(label)
  }
  if (!SIG_PURPOSES.includes(input.purpose)) {
    throw new Error(`unknown signature purpose: ${input.purpose}`)
  }
  if (!input.challenge) {
    throw new Error('challenge is required')
  }

  const identity = deriveAllIdentities(seed)[label]
  const assertion: IdentityAssertion = {
    type: 'para.identity.pop.v1',
    purpose: input.purpose,
    audience: input.audience,
    identityPub: bytesToHex(identity.pub),
    challenge: input.challenge,
    signedAt: input.signedAt ?? new Date().toISOString(),
  }

  const secret = secretKeyFor(identity)
  try {
    // sign() mixes `random` into the nonce; omitting it lets the library
    // supply randomness. Either way the stored nonce seed contributes, so a
    // failed RNG cannot produce a repeated nonce on its own.
    const signature = sign(secret, encodeAssertion(assertion), random)
    return { assertion, signature: bytesToHex(signature) }
  } finally {
    secret.fill(0)
  }
}

/**
 * Verify an assertion. Server side; also used by the tests.
 *
 * `expected` pins what the verifier requires. A signature is only valid for the
 * purpose and audience it was made for — checking the signature alone would let
 * a registration assertion log someone into Matrix.
 */
export function verifyIdentityAssertion(
  signed: SignedAssertion,
  expected: { purpose: SigPurpose; audience: string; challenge: string },
): boolean {
  // Everything below runs on attacker-controlled input from a public endpoint.
  // Guard the shape before touching any field: a null or malformed body must
  // be a rejection, never an exception.
  if (!signed || typeof signed !== 'object') return false
  const { assertion, signature } = signed as SignedAssertion
  if (!assertion || typeof assertion !== 'object') return false
  if (typeof signature !== 'string') return false
  if (assertion.type !== 'para.identity.pop.v1') return false
  if (assertion.purpose !== expected.purpose) return false
  if (assertion.audience !== expected.audience) return false
  if (assertion.challenge !== expected.challenge) return false

  try {
    const pub = hexToBytesStrict(assertion.identityPub, 32)
    const sig = hexToBytesStrict(signature, 64)
    // sr25519's verify() THROWS on a malformed point or signature rather than
    // returning false. This runs on a public endpoint: uncaught, garbage input
    // becomes a 500 instead of a clean auth failure. Any failure to verify,
    // for any reason, is a rejection.
    return verify(encodeAssertion(assertion), sig, pub)
  } catch {
    return false
  }
}

function hexToBytesStrict(hex: string, length: number): Uint8Array {
  if (typeof hex !== 'string' || hex.length !== length * 2) {
    throw new Error('bad hex length')
  }
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) throw new Error('bad hex')
    out[i] = byte
  }
  return out
}

/**
 * The sr25519 public key for an identity. Must equal identity_pub_i — this is
 * the property the G0 spike established and the tests pin.
 */
export function identitySigningPublicKey(identity: DerivedIdentity): Uint8Array {
  const secret = secretKeyFor(identity)
  try {
    return getPublicKey(secret)
  } finally {
    secret.fill(0)
  }
}

/** Exported for tests: the labels that may ever sign. */
export const SIGNING_IDENTITY_LABELS = MATRIX_IDENTITY_LABELS

/** Exported for tests only. */
export const __internal = { encodeSecretScalar, deriveNonceSeed, CURVE_ORDER }

export { bytesToNumberLE }
