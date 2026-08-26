import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha256'
import {
  SPACE_DELEGATION_TOKEN_TTL_SECONDS,
} from '../../contracts/spaceApi'
import type {
  DPoPProofClaims,
  GetSpaceCredentialInput,
  SpaceCredentialClaims,
  SpaceId,
} from '../../contracts/spaceApi'

/**
 * On-device mechanics of the atproto Spaces credential flow (proposal 0016):
 * ES256 JWTs, RFC 7638 thumbprints, RFC 9449 DPoP proofs, space URIs, and
 * credential binding checks.
 *
 * Deliberately no network. The delegation-token call needs the app's OAuth
 * session with the user's PDS and the credential exchange needs the space
 * host, neither of which exists in iM8 yet — so every network touchpoint is
 * an injected callback and this module stays pure and testable. Phase 2 wires
 * the callbacks to real endpoints.
 *
 * parseSpaceCredential checks structure and key/space binding but cannot
 * verify the authority's signature: that requires DID resolution, which
 * arrives with the real network layer. An unverified credential must be
 * surfaced as such in the UI, same posture as `unsigned` artifacts.
 */

/** P-256 public key in JWK form, the only shape the DPoP header carries. */
export type EcPublicJwk = {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
}

export type DPoPKey = {
  privateKey: Uint8Array
  jwk: EcPublicJwk
  /** RFC 7638 thumbprint of jwk; what cnf.jkt must match. */
  jkt: string
}

/**
 * A space credential plus the key it is DPoP-bound to. The private key only
 * needs to live as long as the credential; discard the bundle on expiry.
 */
export type SpaceCredentialBundle = {
  credential: string
  claims: SpaceCredentialClaims
  key: DPoPKey
}

export type RandomBytes = (length: number) => Uint8Array

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(text: string): Uint8Array {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function newJti(random: RandomBytes): string {
  // 16 random bytes as hex; only uniqueness is required.
  return Array.from(random(16))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * RFC 7638 JWK thumbprint: SHA-256 over the canonical JSON of the required
 * members only, lexicographically ordered, no whitespace. Required members
 * depend on kty; RSA is included so the canonicalization is testable against
 * the RFC's published vector.
 */
export function jwkThumbprint(jwk: Record<string, string>): string {
  const required =
    jwk.kty === 'EC' ? ['crv', 'kty', 'x', 'y'] : jwk.kty === 'RSA' ? ['e', 'kty', 'n'] : ['crv', 'kty', 'x']
  const members: Record<string, string> = {}
  for (const key of required.sort()) members[key] = jwk[key]
  return base64Url(sha256(utf8ToBytes(JSON.stringify(members))))
}

/**
 * Compact JWT with an ES256 (raw r||s, RFC 7518 §3.4) signature. Header and
 * payload are serialized in insertion order, so callers control member order
 * by construction.
 */
export function signEs256Jwt(
  privateKey: Uint8Array,
  header: Record<string, unknown>,
  payload: Record<string, unknown>
): string {
  const encodedHeader = base64Url(utf8ToBytes(JSON.stringify(header)))
  const encodedPayload = base64Url(utf8ToBytes(JSON.stringify(payload)))
  const signature = p256
    .sign(sha256(utf8ToBytes(`${encodedHeader}.${encodedPayload}`)), privateKey)
    .toBytes('compact')
  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`
}

export type DecodedJwt = {
  header: Record<string, unknown>
  payload: Record<string, unknown>
}

export function decodeJwt(jwt: string): DecodedJwt | null {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])))
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])))
    if (typeof header !== 'object' || header === null) return null
    if (typeof payload !== 'object' || payload === null) return null
    return { header, payload }
  } catch {
    return null
  }
}

/**
 * Fresh P-256 keypair for one space credential. The spec asks for a new key
 * per credential, discarded at expiry, so this is deliberately not derived
 * from the PARA seed — DPoP keys carry no identity.
 */
export function createDPoPKey(random: RandomBytes): DPoPKey {
  let privateKey = random(32)
  while (privateKey.every((byte) => byte === 0) || bytesToBigInt(privateKey) >= p256.CURVE.n) {
    privateKey = random(32)
  }
  const publicKey = p256.getPublicKey(privateKey, false)
  const jwk: EcPublicJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64Url(publicKey.slice(1, 33)),
    y: base64Url(publicKey.slice(33, 65)),
  }
  return { privateKey, jwk, jkt: jwkThumbprint(jwk) }
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n
  for (const byte of bytes) value = (value << 8n) | BigInt(byte)
  return value
}

/**
 * RFC 9449 DPoP proof for one request. `accessToken` is present when the
 * proof accompanies a token (ath = b64url(sha256(token))) and absent when it
 * accompanies an authorization grant such as a delegation token.
 */
export function createDPoPProof(
  key: DPoPKey,
  request: { htm: string; htu: string; now: number; jti: string; accessToken?: string }
): string {
  const claims: DPoPProofClaims = {
    jti: request.jti,
    htm: request.htm,
    htu: request.htu,
    iat: request.now,
  }
  if (request.accessToken !== undefined) {
    claims.ath = base64Url(sha256(utf8ToBytes(request.accessToken)))
  }
  return signEs256Jwt(key.privateKey, { typ: 'dpop+jwt', alg: 'ES256', jwk: key.jwk }, claims)
}

/**
 * Client attestation identifying this app to a space authority that gates on
 * app identity. The authority resolves the client_id (iss) to the app's
 * published JWKS and verifies against `kid`.
 */
export function createClientAttestation(
  key: DPoPKey,
  input: {
    clientId: string
    audience: string
    now: number
    jti: string
    kid?: string
    ttlSeconds?: number
  }
): string {
  const ttl = input.ttlSeconds ?? SPACE_DELEGATION_TOKEN_TTL_SECONDS
  return signEs256Jwt(
    key.privateKey,
    { typ: 'atproto-client-attestation+jwt', alg: 'ES256', kid: input.kid ?? 'key-1' },
    {
      iss: input.clientId,
      sub: input.clientId,
      aud: input.audience,
      iat: input.now,
      exp: input.now + ttl,
      jti: input.jti,
    }
  )
}

export type SpaceCredentialParseResult =
  | { status: 'valid'; claims: SpaceCredentialClaims }
  | { status: 'expired' }
  | { status: 'wrong-space' }
  | { status: 'wrong-key' }
  | { status: 'malformed' }

/**
 * Parses a space credential and checks every binding iM8 can check without
 * the authority's public key: shape, expiry, target space, and DPoP key
 * binding (cnf.jkt). Signature verification needs DID resolution and lands
 * with the network layer; until then treat a `valid` result as
 * structurally sound, not authenticated.
 */
export function parseSpaceCredential(
  credential: string,
  expected?: { spaceUri?: string; jkt?: string; now?: number }
): SpaceCredentialParseResult {
  const decoded = decodeJwt(credential)
  if (decoded === null) return { status: 'malformed' }

  const { header, payload } = decoded
  if (header.typ !== 'atproto-space-credential+jwt') return { status: 'malformed' }

  const claims = payload as Partial<SpaceCredentialClaims>
  if (
    typeof claims.iss !== 'string' ||
    typeof claims.sub !== 'string' ||
    typeof claims.iat !== 'number' ||
    typeof claims.exp !== 'number' ||
    typeof claims.jti !== 'string' ||
    typeof claims.cnf?.jkt !== 'string'
  ) {
    return { status: 'malformed' }
  }

  const now = expected?.now ?? Math.floor(Date.now() / 1000)
  if (claims.exp <= now) return { status: 'expired' }

  if (expected?.spaceUri !== undefined && claims.sub !== expected.spaceUri) {
    return { status: 'wrong-space' }
  }

  if (expected?.jkt !== undefined && claims.cnf.jkt !== expected.jkt) {
    return { status: 'wrong-key' }
  }

  return { status: 'valid', claims: claims as SpaceCredentialClaims }
}

export function formatSpaceUri(space: SpaceId): string {
  return `at://${space.authority}/space/${space.spaceType}/${space.skey}`
}

export function formatSpaceRecordUri(
  space: SpaceId,
  author: { did: string; collection: string; rkey: string }
): string {
  return `${formatSpaceUri(space)}/${author.did}/${author.collection}/${author.rkey}`
}

export type ParsedSpaceUri =
  | { kind: 'space'; id: SpaceId }
  | { kind: 'record'; id: SpaceId; authorDid: string; collection: string; rkey: string }

/**
 * Parses the space form of an at:// URI. The literal `space` marker sits where
 * a collection NSID would appear in a public URI; since NSIDs always contain
 * at least two dots and `space` contains none, the two never collide — a URI
 * without the marker parses to null here, not to a wrong space.
 */
export function parseSpaceUri(uri: string): ParsedSpaceUri | null {
  if (!uri.startsWith('at://')) return null
  const segments = uri.slice('at://'.length).split('/')
  if (segments.length !== 4 && segments.length !== 7) return null
  if (segments[1] !== 'space') return null

  const id: SpaceId = {
    authority: segments[0],
    spaceType: segments[2],
    skey: segments[3],
  }
  for (const value of [id.authority, id.spaceType, id.skey]) {
    if (!value) return null
  }

  if (segments.length === 4) {
    return { kind: 'space', id }
  }

  const [authorDid, collection, rkey] = segments.slice(4)
  if (!authorDid || !collection || !rkey) return null
  return { kind: 'record', id, authorDid, collection, rkey }
}

/**
 * Runs the credential exchange against an injected endpoint:
 *   1. delegationToken, already minted by the user's PDS under OAuth
 *   2. exchangeCredential performs POST getSpaceCredential at
 *      credentialEndpoint (used verbatim as the proof's htu) and returns the
 *      raw credential JWT; a client attestation is appended when the space
 *      gates on app identity
 * then parses and binding-checks the result. The proof is minted here so the
 * DPoP key that will carry the credential is the same key that asked for it.
 */
export async function obtainSpaceCredential(input: {
  space: SpaceId
  now: number
  createKey: () => DPoPKey
  random: RandomBytes
  credentialEndpoint: string
  delegationToken: string
  clientAttestation?: string
  exchangeCredential: (dpopProof: string, exchangeInput: GetSpaceCredentialInput) => Promise<string>
}): Promise<SpaceCredentialBundle> {
  const key = input.createKey()
  const dpopProof = createDPoPProof(key, {
    htm: 'POST',
    htu: input.credentialEndpoint,
    now: input.now,
    jti: newJti(input.random),
  })
  const credential = await input.exchangeCredential(dpopProof, {
    delegationToken: input.delegationToken,
    clientAttestation: input.clientAttestation,
  })
  const spaceUri = formatSpaceUri(input.space)
  const parsed = parseSpaceCredential(credential, { spaceUri, jkt: key.jkt, now: input.now })
  if (parsed.status !== 'valid') {
    throw new Error(`Space authority returned a ${parsed.status} credential`)
  }
  return { credential, claims: parsed.claims, key }
}

/**
 * The two headers every credential-authenticated repo read carries:
 * `Authorization: DPoP <credential>` plus a per-request proof.
 */
export function credentialAuthHeaders(
  bundle: SpaceCredentialBundle,
  request: { htm: string; htu: string; now: number; jti: string }
): { Authorization: string; DPoP: string } {
  return {
    Authorization: `DPoP ${bundle.credential}`,
    DPoP: createDPoPProof(bundle.key, { ...request, accessToken: bundle.credential }),
  }
}

/** Refresh once the credential is within this window of expiring. */
export const SPACE_CREDENTIAL_REFRESH_SKEW_SECONDS = 300

export function credentialNeedsRefresh(bundle: SpaceCredentialBundle, now: number): boolean {
  return bundle.claims.exp - now <= SPACE_CREDENTIAL_REFRESH_SKEW_SECONDS
}
