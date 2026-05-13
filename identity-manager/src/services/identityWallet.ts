import { generateKeyPairSync, randomBytes, randomUUID, sign, verify } from 'node:crypto'
import type {
  M8IdentityCredential,
  M8IdentityCredentialClaims,
  M8IdentityElementId,
  M8IdentityRequest,
  M8IdentityRequestInput,
  M8IdentityVerificationResult,
  M8TrustedIssuer,
  M8WalletPresentation,
} from '../types/index.js'

const DEFAULT_MERCHANT_IDENTIFIER = 'merchant.m8.identity.dev'
const DEFAULT_REQUEST_TTL_SECONDS = 5 * 60
const PRESENTATION_TTL_SECONDS = 90

// In production, load from APP_KEY-encrypted persistent storage.
// For this sprint we generate at boot but keep stable within process.
let _ineIssuerKey: ReturnType<typeof generateKeyPairSync> | null = null
let _demoWalletKey: ReturnType<typeof generateKeyPairSync> | null = null

function getIneIssuerKey() {
  if (!_ineIssuerKey) {
    _ineIssuerKey = generateKeyPairSync('ed25519')
  }
  return _ineIssuerKey
}

function getDemoWalletKey() {
  if (!_demoWalletKey) {
    _demoWalletKey = generateKeyPairSync('ed25519')
  }
  return _demoWalletKey
}

export const TRUSTED_ISSUERS: M8TrustedIssuer[] = [
  {
    did: 'did:m8:ine:emisor-001',
    name: 'Instituto Nacional Electoral',
    country: 'MX',
    status: 'active',
    publicKeyPem: '',
    allowedElements: ['age_over_18', 'age_over_21', 'citizenship', 'district_hash', 'curp_hash'],
  },
  {
    did: 'did:m8:renapo:emisor-001',
    name: 'RENAPO',
    country: 'MX',
    status: 'suspended',
    publicKeyPem: '',
    allowedElements: ['citizenship', 'curp_hash'],
  },
]

// Lazy-init PEMs after keys are generated
function ensureIssuerPems() {
  const ineKey = getIneIssuerKey()
  if (!TRUSTED_ISSUERS[0].publicKeyPem) {
    TRUSTED_ISSUERS[0].publicKeyPem = ineKey.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  }
  if (!TRUSTED_ISSUERS[1].publicKeyPem) {
    TRUSTED_ISSUERS[1].publicKeyPem = ineKey.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  }
}

function nowIso() {
  return new Date().toISOString()
}

function addSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function base64url(value: Buffer) {
  return value.toString('base64url')
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`
}

function signedCredentialPayload(credential: Omit<M8IdentityCredential, 'signature'>) {
  return stableJson({
    id: credential.id,
    issuerDid: credential.issuerDid,
    subjectDid: credential.subjectDid,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    claims: credential.claims,
    revocationHash: credential.revocationHash,
    signatureAlg: credential.signatureAlg,
  })
}

function signedPresentationPayload(presentation: Omit<M8WalletPresentation, 'signature'>) {
  return stableJson(presentation)
}

function signPayload(payload: string, privateKey: ReturnType<typeof getIneIssuerKey>['privateKey']) {
  return base64url(sign(null, Buffer.from(payload), privateKey))
}

function verifyPayload(payload: string, signature: string, publicKeyPem: string) {
  return verify(null, Buffer.from(payload), publicKeyPem, Buffer.from(signature, 'base64url'))
}

function validateRequestedElements(elements: M8IdentityRequestInput['requestedElements']) {
  if (!Array.isArray(elements) || elements.length === 0) {
    throw new Error('requestedElements must contain at least one identity element')
  }

  const seen = new Set<string>()
  for (const element of elements) {
    if (!element?.id || seen.has(element.id)) {
      throw new Error('requestedElements must be unique and include an id')
    }
    seen.add(element.id)

    if (!element.intentToStore?.mode) {
      throw new Error(`intentToStore is required for ${element.id}`)
    }

    if (element.intentToStore.mode === 'may-store' && element.intentToStore.days <= 0) {
      throw new Error(`may-store intent for ${element.id} must include positive days`)
    }
  }
}

export function createIdentityRequest(
  sessionId: string,
  input: M8IdentityRequestInput
): M8IdentityRequest {
  if (!input.audienceAppId?.trim()) throw new Error('audienceAppId is required')
  if (!input.audienceAppName?.trim()) throw new Error('audienceAppName is required')
  if (!input.purpose?.trim()) throw new Error('purpose is required')

  validateRequestedElements(input.requestedElements)

  const ttl = input.expiresInSeconds ?? DEFAULT_REQUEST_TTL_SECONDS
  if (ttl < 30 || ttl > 15 * 60) {
    throw new Error('expiresInSeconds must be between 30 and 900 seconds')
  }

  return {
    id: `identity-request-${randomUUID()}`,
    sessionId,
    nonce: base64url(randomBytes(32)),
    audienceAppId: input.audienceAppId,
    audienceAppName: input.audienceAppName,
    purpose: input.purpose,
    merchantIdentifier: input.merchantIdentifier ?? DEFAULT_MERCHANT_IDENTIFIER,
    requestedElements: input.requestedElements,
    status: 'active',
    createdAt: nowIso(),
    expiresAt: addSeconds(ttl),
    usedAt: null,
  }
}

export function createDemoWalletPresentation(params: {
  request: M8IdentityRequest
  subjectDid: string
  selectedElementIds?: M8IdentityElementId[]
}): M8WalletPresentation {
  ensureIssuerPems()
  const selected = new Set(
    params.selectedElementIds ?? params.request.requestedElements.map((element) => element.id)
  )
  const claims: M8IdentityCredentialClaims = {
    age_over_18: true,
    age_over_21: true,
    citizenship: 'MX',
    district_hash: 'sha256:district:mx-jal-10',
    curp_hash: 'sha256:curp:redacted-demo',
  }
  const disclosedClaims = Object.fromEntries(
    Object.entries(claims).filter(([key]) => selected.has(key as M8IdentityElementId))
  ) as M8IdentityCredentialClaims

  const ineKey = getIneIssuerKey()
  const walletKey = getDemoWalletKey()

  const unsignedCredential: Omit<M8IdentityCredential, 'signature'> = {
    id: `credential-${randomUUID()}`,
    issuerDid: 'did:m8:ine:emisor-001',
    subjectDid: params.subjectDid,
    issuedAt: nowIso(),
    expiresAt: addSeconds(365 * 24 * 60 * 60),
    claims,
    revocationHash: base64url(randomBytes(32)),
    signatureAlg: 'Ed25519',
  }
  const credential: M8IdentityCredential = {
    ...unsignedCredential,
    signature: signPayload(signedCredentialPayload(unsignedCredential), ineKey.privateKey),
  }

  const unsignedPresentation: Omit<M8WalletPresentation, 'signature'> = {
    type: 'm8.identity.presentation.v1',
    requestId: params.request.id,
    nonce: params.request.nonce,
    audienceAppId: params.request.audienceAppId,
    credential,
    disclosedClaims,
    devicePublicKey: walletKey.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    issuedAt: nowIso(),
    expiresAt: addSeconds(PRESENTATION_TTL_SECONDS),
    signatureAlg: 'Ed25519',
  }

  return {
    ...unsignedPresentation,
    signature: signPayload(signedPresentationPayload(unsignedPresentation), walletKey.privateKey),
  }
}

export function verifyWalletPresentation(
  request: M8IdentityRequest,
  presentation: M8WalletPresentation,
  trustedIssuers = TRUSTED_ISSUERS
): M8IdentityVerificationResult {
  ensureIssuerPems()
  const errors: string[] = []
  const warnings: string[] = []
  const checkedAt = nowIso()
  const issuer = trustedIssuers.find((entry) => entry.did === presentation.credential?.issuerDid) ?? null

  if (request.status !== 'active') errors.push('identity request is not active')
  if (new Date(request.expiresAt).getTime() <= Date.now()) errors.push('identity request expired')
  if (presentation.type !== 'm8.identity.presentation.v1') errors.push('unsupported presentation type')
  if (presentation.requestId !== request.id) errors.push('presentation requestId does not match')
  if (presentation.nonce !== request.nonce) errors.push('presentation nonce does not match')
  if (presentation.audienceAppId !== request.audienceAppId) {
    errors.push('presentation audience does not match')
  }
  if (new Date(presentation.expiresAt).getTime() <= Date.now()) {
    errors.push('presentation expired')
  }
  if (new Date(presentation.credential.expiresAt).getTime() <= Date.now()) {
    errors.push('credential expired')
  }
  if (!issuer) {
    errors.push('credential issuer is not trusted')
  } else if (issuer.status !== 'active') {
    errors.push(`credential issuer is ${issuer.status}`)
  }

  const requested = new Set(request.requestedElements.map((element) => element.id))
  const disclosed = Object.keys(presentation.disclosedClaims) as M8IdentityElementId[]
  for (const claimId of disclosed) {
    if (!requested.has(claimId)) errors.push(`claim ${claimId} was not requested`)
    if (issuer && !issuer.allowedElements.includes(claimId)) {
      errors.push(`issuer is not allowed to attest ${claimId}`)
    }
  }

  for (const element of request.requestedElements) {
    if (element.required && !(element.id in presentation.disclosedClaims)) {
      errors.push(`required claim ${element.id} was not disclosed`)
    }
    if (element.intentToStore.mode === 'may-store-until-revoked') {
      warnings.push(`long-lived storage requested for ${element.id}; audit retention policy`)
    }
  }

  if (issuer) {
    const { signature, ...credentialPayload } = presentation.credential
    if (!verifyPayload(signedCredentialPayload(credentialPayload), signature, issuer.publicKeyPem)) {
      errors.push('credential issuer signature is invalid')
    }
  }

  const { signature, ...presentationPayload } = presentation
  if (!verifyPayload(signedPresentationPayload(presentationPayload), signature, presentation.devicePublicKey)) {
    errors.push('wallet presentation signature is invalid')
  }

  return {
    valid: errors.length === 0,
    requestId: request.id,
    presentationId: `${presentation.requestId}:${presentation.nonce}`,
    issuerDid: issuer?.did ?? presentation.credential?.issuerDid ?? null,
    issuerName: issuer?.name ?? null,
    subjectDid: presentation.credential?.subjectDid ?? null,
    disclosedClaims: errors.length === 0 ? presentation.disclosedClaims : {},
    checkedAt,
    errors,
    warnings,
  }
}
