import { verify } from '@scure/sr25519'
import { utf8ToBytes } from '@noble/hashes/utils'
import { hexToBytes } from '@noble/curves/abstract/utils'
import type { ProofBrokerProofArtifact } from '../contracts/proofBroker'

/**
 * Client-side verification of a proof artifact.
 *
 * This is the step that separates a verifier from a viewer. Until it runs, the
 * app renders whatever `outcome` the broker sent — so a compromised broker, an
 * intermediary, or a plain server bug all produce the same visible result as a
 * genuine verification.
 *
 * Deliberately returns a status rather than a boolean. The broker does not
 * sign yet, so today every artifact resolves to `unsigned`, and the honest
 * response is to show that in the UI — not to fail closed and break the app,
 * and emphatically not to fall back to trusting the string.
 */

export type ArtifactVerification =
  | { status: 'verified'; issuerPub: string }
  /** No attestation attached. Unverifiable — which is not the same as invalid. */
  | { status: 'unsigned' }
  /** Signed by a key we were not told to trust. */
  | { status: 'untrusted-issuer'; issuerPub: string }
  | { status: 'bad-signature' }
  | { status: 'expired'; expiredAt: string }
  | { status: 'revoked' }
  /** Minted for a different app — replaying it here must not succeed. */
  | { status: 'wrong-audience'; expected: string; found: string }
  | { status: 'malformed'; reason: string }

export interface VerifyOptions {
  /** Issuer public keys this client accepts, 32-byte hex. */
  trustedIssuers: readonly string[]
  /** The app the artifact must name as its audience. */
  audienceAppId: string
  /** Injectable for tests; defaults to now. */
  now?: Date
}

/**
 * Canonical encoding of the fields an issuer attests to.
 *
 * Field order is fixed here rather than left to JSON.stringify, so a verifier
 * written in another language cannot disagree with us about what was signed.
 * Every field that changes the meaning of the artifact is covered: leaving one
 * out would let it be edited after signing without breaking the signature.
 */
export function encodeArtifact(a: ProofBrokerProofArtifact): Uint8Array {
  return utf8ToBytes(
    [
      'para.artifact.v1',
      a.id,
      a.grantId,
      a.requestId,
      a.claimType,
      a.requestedValue ?? '',
      a.outcome,
      a.statement,
      a.proofMode,
      a.issuerId,
      a.verifierId,
      a.audienceAppId,
      a.surface,
      a.issuedAt,
      a.expiresAt ?? '',
    ].join('\n'),
  )
}

function isHex(value: unknown, bytes: number): value is string {
  return (
    typeof value === 'string' &&
    value.length === bytes * 2 &&
    /^[0-9a-fA-F]+$/.test(value)
  )
}

export function verifyProofArtifact(
  artifact: ProofBrokerProofArtifact,
  options: VerifyOptions,
): ArtifactVerification {
  // Everything below is attacker-controlled input from a network response.
  // Guard the shape before touching a field: malformed input is a rejection,
  // never an exception.
  if (!artifact || typeof artifact !== 'object') {
    return { status: 'malformed', reason: 'artifact is not an object' }
  }

  if (artifact.status === 'revoked') return { status: 'revoked' }

  // Audience first: an artifact minted for another app is the replay case, and
  // saying so is more useful than "bad signature" — the signature is fine.
  if (artifact.audienceAppId !== options.audienceAppId) {
    return {
      status: 'wrong-audience',
      expected: options.audienceAppId,
      found: String(artifact.audienceAppId),
    }
  }

  const now = options.now ?? new Date()
  if (artifact.expiresAt) {
    const expiry = new Date(artifact.expiresAt)
    if (Number.isNaN(expiry.getTime())) {
      return { status: 'malformed', reason: 'expiresAt is not a date' }
    }
    if (expiry.getTime() <= now.getTime()) {
      return { status: 'expired', expiredAt: artifact.expiresAt }
    }
  }

  const attestation = artifact.attestation
  if (!attestation) return { status: 'unsigned' }

  if (
    attestation.alg !== 'para.artifact.v1' ||
    !isHex(attestation.issuerPub, 32) ||
    !isHex(attestation.signature, 64)
  ) {
    return { status: 'malformed', reason: 'attestation is malformed' }
  }

  // Trust is checked before the signature: a valid signature from a key we
  // never trusted is not a weaker result, it is a different one.
  const trusted = options.trustedIssuers.some(
    (key) => key.toLowerCase() === attestation.issuerPub.toLowerCase(),
  )
  if (!trusted) {
    return { status: 'untrusted-issuer', issuerPub: attestation.issuerPub }
  }

  try {
    // sr25519's verify() throws on a malformed point rather than returning
    // false; any failure to verify, for any reason, is a rejection.
    const ok = verify(
      encodeArtifact(artifact),
      hexToBytes(attestation.signature),
      hexToBytes(attestation.issuerPub),
    )
    return ok
      ? { status: 'verified', issuerPub: attestation.issuerPub }
      : { status: 'bad-signature' }
  } catch {
    return { status: 'bad-signature' }
  }
}

/** Only a cryptographically checked artifact may be shown as verified. */
export function isTrustworthy(result: ArtifactVerification): boolean {
  return result.status === 'verified'
}

/** Short, user-facing reason, for the UI to show instead of a bare outcome. */
export function describeVerification(result: ArtifactVerification): string {
  switch (result.status) {
    case 'verified':
      return 'Verificado criptográficamente'
    case 'unsigned':
      return 'Sin firma del emisor — no se puede comprobar'
    case 'untrusted-issuer':
      return 'Firmado por un emisor que no reconocemos'
    case 'bad-signature':
      return 'La firma no corresponde'
    case 'expired':
      return 'La prueba expiró'
    case 'revoked':
      return 'La prueba fue revocada'
    case 'wrong-audience':
      return 'Emitida para otra aplicación'
    case 'malformed':
      return 'La prueba está mal formada'
  }
}
