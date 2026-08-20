import { sha256 } from '@noble/hashes/sha2'
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils'
import { bytesToHex } from '@noble/curves/abstract/utils'
import {
  deriveAllIdentities,
  type DerivedIdentity,
  type IdentityLabel,
} from './keyDerivation'

/*
 * Matrix v2 identity derivation, client side.
 * Normative spec: WatZappa/docs/MATRIX_V2.md §4 (MXID derivation) and the
 * decision record CD-M1 in the same file.
 *
 * The point of this module: the MXID is a pure function of identity_pub_i, so
 * the homeserver never needs — and must never hold — a table relating a DID,
 * a seed, or one identity to another. That is the same property mubEZ's
 * registration contract enforces (docs/IDENTITY_DERIVATION.md, "No table may
 * relate two identity public keys"), applied to Matrix accounts.
 *
 * Like keyDerivation.ts this module is pure: no React Native imports, no
 * storage, no randomness, no network. That is what lets the boundary tests run
 * under node:test and makes the derivation reproducible off-device.
 */

export const DOMAIN_MATRIX_LOCALPART = 'para-id/matrix-localpart/v1'

/*
 * Identity labels that may hold a Matrix account.
 *
 * NAMING TRAP — read before editing. The Matrix v2 plan speaks of "public",
 * "community" and "voting" identities. This codebase's labels (keyDerivation.ts
 * IDENTITY_INDEXES, and mubEZ docs/IDENTITY_DERIVATION.md) are "public",
 * "civic" and "anonymous". They do not line up by name:
 *
 *   plan "voting"    = index 1 `civic`     — "Civic participation (ballots,
 *                                            delegation)" per the spec table.
 *   plan "community" = index 2 `anonymous` — the pseudonymous posting surface.
 *
 * So `civic` is the ballot identity and is the one that must never reach
 * Matrix, despite "civic" sounding like the community identity. Getting this
 * backwards would put the ballot key on a chat server, which the plan forbids
 * absolutely (§4 layer-boundary table: ballots and the voting identity are
 * "✗ never" in Matrix).
 */
export const MATRIX_IDENTITY_LABELS = ['public', 'anonymous'] as const
export type MatrixIdentityLabel = (typeof MATRIX_IDENTITY_LABELS)[number]

/** The ballot/delegation identity. Never authenticates to Matrix. */
export const BALLOT_IDENTITY_LABEL: IdentityLabel = 'civic'

/**
 * Localpart length in bytes of digest retained. 20 bytes = 160 bits = exactly
 * 32 base32 characters with no padding. See CD-M1 for why truncation is safe
 * here (the full public key is presented at authentication time anyway, so the
 * digest is a formatting device, not a secret).
 */
const LOCALPART_BYTES = 20

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

/**
 * RFC 4648 base32, lowercased and unpadded.
 *
 * Lowercase matters: the Matrix historical user-ID grammar allows only
 * `[a-z0-9._=/+-]` in a localpart, so the standard uppercase base32 alphabet
 * would produce invalid MXIDs. The output charset `[a-z2-7]` is a strict
 * subset of what the grammar permits.
 *
 * Exported for the RFC test vectors; not part of the module's intended API.
 */
export function base32LowerNoPad(bytes: Uint8Array): string {
  let value = 0
  let bits = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return out
}

/**
 * Thrown when a caller asks for a Matrix identity for an identity that must
 * not have one. A distinct type so the identity-boundary tests assert on the
 * refusal itself rather than on message text.
 */
export class MatrixIdentityForbiddenError extends Error {
  constructor(readonly label: string) {
    super(
      `identity "${label}" must not have a Matrix account: only ${MATRIX_IDENTITY_LABELS.join(
        ' and ',
      )} may authenticate to Matrix`,
    )
    this.name = 'MatrixIdentityForbiddenError'
  }
}

/**
 * A Matrix identity, safe to hand to the login/provisioning layer.
 *
 * Deliberately carries no private scalar. Proof of possession is a separate,
 * still-undecided step (MATRIX_V2.md, open decision OD-2); keeping the private
 * key out of this object means nothing downstream of here can sign with an
 * identity key by accident.
 */
export interface MatrixIdentity {
  label: MatrixIdentityLabel
  index: number
  /** 32-byte ristretto255 identity public key, hex. The only value a server sees. */
  identityPubHex: string
  /** base32(sha256(domain ‖ identity_pub)[..20]) — 32 chars, lowercase. */
  localpart: string
  /** `@<localpart>:<serverName>` */
  mxid: string
}

export function isMatrixIdentityLabel(
  label: string,
): label is MatrixIdentityLabel {
  return (MATRIX_IDENTITY_LABELS as readonly string[]).includes(label)
}

/**
 * localpart_i = base32_lower_nopad( SHA-256(DOMAIN ‖ identity_pub_i)[0..20] )
 *
 * Domain-separated so this digest can never coincide with another use of the
 * same public key, following the convention in keyDerivation.ts.
 */
export function matrixLocalpart(identityPub: Uint8Array): string {
  if (identityPub.length !== 32) {
    throw new Error('identity public key must be exactly 32 bytes')
  }
  const digest = sha256(
    concatBytes(utf8ToBytes(DOMAIN_MATRIX_LOCALPART), identityPub),
  )
  return base32LowerNoPad(digest.subarray(0, LOCALPART_BYTES))
}

/**
 * Build a Matrix identity from an already-derived identity, enforcing the
 * boundary. Use this when the caller already holds the derived identity and
 * should not re-handle the seed.
 */
export function matrixIdentityFor(
  identity: DerivedIdentity,
  serverName: string,
): MatrixIdentity {
  if (!isMatrixIdentityLabel(identity.label)) {
    throw new MatrixIdentityForbiddenError(identity.label)
  }
  if (!serverName) {
    throw new Error('serverName is required to build an MXID')
  }
  const localpart = matrixLocalpart(identity.pub)
  return {
    label: identity.label,
    index: identity.index,
    identityPubHex: bytesToHex(identity.pub),
    localpart,
    mxid: `@${localpart}:${serverName}`,
  }
}

/**
 * The entry point named in the Matrix v2 plan §3.2: `getMatrixIdentity(i)` for
 * i ∈ {public, community}, refusing the voting identity.
 *
 * Refusal is an allowlist, not a denylist: an identity index added later
 * (the derivation spec reserves indexes ≥ 3) is refused until it is
 * explicitly listed, so the fail-safe direction is "no Matrix account".
 */
export function getMatrixIdentity(
  seed: Uint8Array,
  label: IdentityLabel,
  serverName: string,
): MatrixIdentity {
  if (!isMatrixIdentityLabel(label)) {
    throw new MatrixIdentityForbiddenError(label)
  }
  const identities = deriveAllIdentities(seed)
  return matrixIdentityFor(identities[label], serverName)
}
