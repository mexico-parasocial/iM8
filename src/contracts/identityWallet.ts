export type M8IdentityElementId =
  | 'age_over_18'
  | 'age_over_21'
  | 'citizenship'
  | 'district_hash'
  | 'curp_hash'
  | 'verified_public_figure'

export type M8IdentityStorageIntent =
  | { mode: 'will-not-store' }
  | { mode: 'may-store'; days: number }
  | { mode: 'may-store-until-revoked' }

export type M8IdentityRequestedElement = {
  id: M8IdentityElementId
  intentToStore: M8IdentityStorageIntent
  required: boolean
}

export type M8IdentityRequestInput = {
  audienceAppId: string
  audienceAppName: string
  purpose: string
  merchantIdentifier?: string
  requestedElements: M8IdentityRequestedElement[]
  expiresInSeconds?: number
  sessionId?: string
}

export type M8IdentityRequest = {
  id: string
  sessionId: string
  nonce: string
  audienceAppId: string
  audienceAppName: string
  purpose: string
  merchantIdentifier: string
  requestedElements: M8IdentityRequestedElement[]
  /** 'declined': the holder's wallet refused to present for it. */
  status: 'active' | 'used' | 'expired' | 'declined'
  createdAt: string
  expiresAt: string
  usedAt: string | null
}

export type M8IdentityCredentialClaims = Partial<Record<M8IdentityElementId, string | boolean>>

/**
 * Issuer-signed credential (mubEZ CD-13). `holderPublicKey` is the wallet's
 * Ed25519 SPKI PEM key, covered by the issuer signature; only credentials
 * that carry one can be presented. Credentials issued before holder binding
 * lack it and must be re-issued.
 */
export type M8IdentityCredential = {
  id: string
  issuerDid: string
  issuerKeyId: string
  subjectDid: string
  issuedAt: string
  expiresAt: string
  claims: M8IdentityCredentialClaims
  revocationHash: string
  holderPublicKey?: string
  signatureAlg: 'Ed25519'
  signature: string
}

/** Identifiers that link presentations to a person; see M8WalletPresentation. */
export const M8_LINKABLE_IDENTITY_ELEMENTS: readonly M8IdentityElementId[] = ['curp_hash', 'district_hash']

/**
 * Full-credential disclosure: the verifier receives the whole credential,
 * every claim included. This is not selective disclosure. `disclosedClaims`
 * names the claims the holder asserts; each must equal the signed value.
 * Signed with the private key matching `credential.holderPublicKey` over the
 * stable (key-sorted) JSON of every other field. A credential holding an
 * identifier in M8_LINKABLE_IDENTITY_ELEMENTS is refused unless the request
 * asked for it, so present `basicCredential` for everything else.
 *
 * v1 (`m8.identity.presentation.v1`, presenter-chosen `devicePublicKey`) is
 * rejected by the server.
 */
export type M8WalletPresentation = {
  type: 'm8.identity.presentation.v2'
  disclosure: 'full-credential'
  requestId: string
  nonce: string
  audienceAppId: string
  credential: M8IdentityCredential
  disclosedClaims: M8IdentityCredentialClaims
  issuedAt: string
  expiresAt: string
  signatureAlg: 'Ed25519'
  signature: string
}

/** The message a wallet signs (Ed25519, base64url) to prove its holder key at issuance. */
export function m8HolderBindingMessage(issuanceChallenge: string): string {
  return `m8.identity.holder-binding.v1:${issuanceChallenge}`
}

/** Holder fields POST /v1/identity/ine/credential requires. */
export type M8HolderKeyBinding = {
  holderPublicKey: string
  holderKeyProof: string
}

/**
 * POST /v1/identity/ine/credential response. Both credentials share the
 * enrollment's holder key and revocationHash. `basicCredential` holds only
 * proven, non-linkable claims (no curp_hash or district_hash).
 */
export type M8IneCredentialIssuance = {
  credential: M8IdentityCredential
  basicCredential: M8IdentityCredential
  proofArtifactId: string
  verificationId: string
  commitment: string
}

export type M8TrustedIssuer = {
  did: string
  keyId: string
  name: string
  country: string
  status: 'active' | 'previous' | 'suspended' | 'revoked' | 'expired'
  notAfter?: string
  publicKeyPem: string
  allowedElements: M8IdentityElementId[]
}

export type M8IdentityVerificationResult = {
  valid: boolean
  requestId: string
  presentationId: string
  issuerDid: string | null
  issuerName: string | null
  subjectDid: string | null
  disclosedClaims: M8IdentityCredentialClaims
  /** Always full-credential: every claim in revealedClaimIds reached the verifier. */
  disclosure: 'full-credential'
  revealedClaimIds: M8IdentityElementId[]
  checkedAt: string
  errors: string[]
  warnings: string[]
}

// ─── Wallet relay (mubEZ CD-14) ───────────────────────────────────────────

/**
 * A PARA request for a holder binding, relayed through the shared M8 session.
 * The wallet answers with a public key and a proof over `issuanceChallenge`;
 * the private key never leaves the device.
 */
export type M8WalletBindingRequest = {
  id: string
  issuanceChallenge: string
  status: 'pending' | 'bound' | 'issued' | 'collected' | 'declined'
  createdAt: string
  expiresAt: string
}

/** What the wallet collects, once, after PARA issued against its binding. */
export type M8WalletCredentialDelivery = {
  proofArtifactId: string
  credential: M8IdentityCredential
  basicCredential: M8IdentityCredential
}

/** The requester's read of an identity request; `result` is returned once. */
export type M8IdentityRequestOutcome = {
  id: string
  status: M8IdentityRequest['status']
  expiresAt: string
  resultDelivered: boolean
  result?: Pick<
    M8IdentityVerificationResult,
    'valid' | 'disclosedClaims' | 'disclosure' | 'revealedClaimIds' | 'issuerDid' | 'checkedAt'
  >
}
