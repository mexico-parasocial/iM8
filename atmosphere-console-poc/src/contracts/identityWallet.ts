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
  status: 'active' | 'used' | 'expired'
  createdAt: string
  expiresAt: string
  usedAt: string | null
}

export type M8IdentityCredentialClaims = Partial<Record<M8IdentityElementId, string | boolean>>

export type M8IdentityCredential = {
  id: string
  issuerDid: string
  subjectDid: string
  issuedAt: string
  expiresAt: string
  claims: M8IdentityCredentialClaims
  revocationHash: string
  signatureAlg: 'Ed25519'
  signature: string
}

export type M8WalletPresentation = {
  type: 'm8.identity.presentation.v1'
  requestId: string
  nonce: string
  audienceAppId: string
  credential: M8IdentityCredential
  disclosedClaims: M8IdentityCredentialClaims
  devicePublicKey: string
  issuedAt: string
  expiresAt: string
  signatureAlg: 'Ed25519'
  signature: string
}

export type M8TrustedIssuer = {
  did: string
  name: string
  country: string
  status: 'active' | 'suspended' | 'revoked'
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
  checkedAt: string
  errors: string[]
  warnings: string[]
}
