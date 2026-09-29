import { ed25519 } from '@noble/curves/ed25519'
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils'
import { sha256 } from '@noble/hashes/sha2'
import { utf8ToBytes } from '@noble/hashes/utils'
import {
  M8_LINKABLE_IDENTITY_ELEMENTS,
  m8HolderBindingMessage,
  type M8IdentityCredential,
  type M8IdentityElementId,
  type M8IdentityRequest,
  type M8IdentityVerificationResult,
  type M8WalletBindingRequest,
  type M8WalletCredentialDelivery,
  type M8WalletPresentation,
} from '../contracts/identityWallet'

/*
 * Holder-key wallet (mubEZ CD-13 / CD-14).
 *
 * The wallet keeps one Ed25519 key per INE enrollment, generated on this
 * device. The issuer signs its public key into the credentials; every
 * presentation must be signed with it. The private key is stored device-only
 * behind user presence (see holderWalletDevice.ts) and leaves this module
 * only as signatures: mubEZ and PARA receive public keys, proofs and signed
 * presentations, never key material.
 *
 * Device loss: there is no backup of a holder key, by design. A holder key
 * derived from the recovery phrase would make every enrollment carry the same
 * public key (linking them) and would let whoever holds the phrase present the
 * credentials. Recovery is: revoke the enrollments this device cannot present
 * (by artifact id, from any signed-in device) and enroll again with a new key.
 *
 * Privacy: a v2 presentation is full-credential and linkable. planPresentation
 * spells out everything a request would reveal — including the stable
 * identifiers — so no approval screen can present it as anonymous.
 *
 * Orchestration only; storage, broker access and randomness are injected, so
 * this runs under `tsx --test` without a device.
 */

/**
 * Closed until device tests and a real issuer integration pass. No screen may
 * reach the wallet while it is false; createDeviceHolderWallet refuses.
 */
export const HOLDER_WALLET_ENABLED = false

/** Presentations live 60 s; mubEZ caps them at 90 s (plus 60 s skew). */
export const PRESENTATION_TTL_MS = 60 * 1000

const INDEX_KEY = 'm8.wallet.holder.index.v1'
const privateKeyStoreKey = (keyId: string) => `m8.wallet.holder.key.${keyId}`

// ─── Encoding ─────────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64Encode(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? B64[n & 63] : '='
  }
  return out
}

export function base64Decode(text: string): Uint8Array {
  const clean = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (/[^A-Za-z0-9+/]/.test(clean) || clean.length % 4 === 1) throw new Error('invalid base64')
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    value = (value << 6) | B64.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((value >> bits) & 0xff)
    }
  }
  return Uint8Array.from(out)
}

export const base64UrlEncode = (bytes: Uint8Array) =>
  base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const SPKI_ED25519_PREFIX = hexToBytes('302a300506032b6570032100')

/** Ed25519 public key as SPKI PEM, byte-identical to Node's export (trimmed). */
export function ed25519PublicKeyToPem(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('Ed25519 public key must be 32 bytes')
  const der = new Uint8Array(SPKI_ED25519_PREFIX.length + 32)
  der.set(SPKI_ED25519_PREFIX)
  der.set(publicKey, SPKI_ED25519_PREFIX.length)
  const lines = base64Encode(der).match(/.{1,64}/g)!.join('\n')
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`
}

export function ed25519PublicKeyFromPem(pem: string): Uint8Array | null {
  const match = /^-----BEGIN PUBLIC KEY-----([A-Za-z0-9+/=\s]+)-----END PUBLIC KEY-----$/.exec(pem.trim())
  if (!match) return null
  let der: Uint8Array
  try {
    der = base64Decode(match[1].replace(/\s+/g, ''))
  } catch {
    return null
  }
  if (der.length !== 44) return null
  for (let i = 0; i < SPKI_ED25519_PREFIX.length; i += 1) {
    if (der[i] !== SPKI_ED25519_PREFIX[i]) return null
  }
  return der.slice(SPKI_ED25519_PREFIX.length)
}

// ─── Canonical JSON and signatures ────────────────────────────────────────

/**
 * Keys sorted by code unit, no whitespace. mubEZ sorts with localeCompare;
 * the conformance vectors pin that both orders agree on every field the
 * format uses, so this client never depends on the platform's collation.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

/** The fields the issuer signs, exactly as mubEZ's signedCredentialPayload. */
export function credentialSignedPayload(credential: Omit<M8IdentityCredential, 'signature'>): string {
  const payload: Record<string, unknown> = {
    id: credential.id,
    issuerDid: credential.issuerDid,
    issuerKeyId: credential.issuerKeyId,
    subjectDid: credential.subjectDid,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    claims: credential.claims,
    revocationHash: credential.revocationHash,
    signatureAlg: credential.signatureAlg,
  }
  if (credential.holderPublicKey !== undefined) payload.holderPublicKey = credential.holderPublicKey
  return canonicalJson(payload)
}

export function verifyCredentialIssuer(credential: M8IdentityCredential, issuerPublicKeyPem: string): boolean {
  const issuerKey = ed25519PublicKeyFromPem(issuerPublicKeyPem)
  if (!issuerKey) return false
  const { signature, ...unsigned } = credential
  try {
    return ed25519.verify(base64Decode(signature), utf8ToBytes(credentialSignedPayload(unsigned)), issuerKey)
  } catch {
    return false
  }
}

export function holderPublicKeyPem(seed: Uint8Array): string {
  return ed25519PublicKeyToPem(ed25519.getPublicKey(seed))
}

/** The proof of possession mubEZ checks at binding. */
export function signHolderBinding(seed: Uint8Array, issuanceChallenge: string): string {
  return base64UrlEncode(ed25519.sign(utf8ToBytes(m8HolderBindingMessage(issuanceChallenge)), seed))
}

export function signPresentation(
  seed: Uint8Array,
  params: {
    request: Pick<M8IdentityRequest, 'id' | 'nonce' | 'audienceAppId'>
    credential: M8IdentityCredential
    disclosedClaimIds: M8IdentityElementId[]
    issuedAt: string
    expiresAt: string
  },
): M8WalletPresentation {
  const disclosedClaims = Object.fromEntries(
    params.disclosedClaimIds
      .filter((id) => Object.prototype.hasOwnProperty.call(params.credential.claims, id))
      .map((id) => [id, params.credential.claims[id]]),
  )
  const unsigned: Omit<M8WalletPresentation, 'signature'> = {
    type: 'm8.identity.presentation.v2',
    disclosure: 'full-credential',
    requestId: params.request.id,
    nonce: params.request.nonce,
    audienceAppId: params.request.audienceAppId,
    credential: params.credential,
    disclosedClaims,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    signatureAlg: 'Ed25519',
  }
  return {
    ...unsigned,
    signature: base64UrlEncode(ed25519.sign(utf8ToBytes(canonicalJson(unsigned)), seed)),
  }
}

// ─── What a presentation reveals ──────────────────────────────────────────

export type WalletEnrollment = {
  proofArtifactId: string
  keyId: string
  credential: M8IdentityCredential
  basicCredential: M8IdentityCredential
  /** True when both issuer signatures checked out against a pinned issuer key. */
  issuerVerified: boolean
  collectedAt: string
  /** Set when the device refused the key (biometrics changed, keychain wiped). */
  keyLost?: boolean
}

/**
 * Values in every v2 presentation that stay the same from one presentation
 * to the next. Any two verifiers that compare them can link the presentations,
 * and `subjectDid` is the account itself.
 */
export type LinkableIdentifiers = {
  subjectDid: string
  credentialId: string
  holderPublicKey: string
  revocationHash: string
  issuedAt: string
}

export type PresentationPlan =
  | {
      presentable: true
      request: M8IdentityRequest
      credentialKind: 'basic' | 'full'
      credential: M8IdentityCredential
      disclosedClaimIds: M8IdentityElementId[]
      /** Every claim the verifier receives: the whole credential. */
      revealedClaims: M8IdentityCredential['claims']
      /** Revealed although the request did not ask for them. */
      unrequestedRevealed: M8IdentityElementId[]
      linkableIdentifiers: LinkableIdentifiers
    }
  | {
      presentable: false
      request: M8IdentityRequest
      reason: 'no-credential' | 'key-unavailable' | 'missing-required-claim' | 'linkable-claims-not-requested'
      missing?: M8IdentityElementId[]
    }

/**
 * Picks the credential for a request and lists what it reveals. The full
 * credential carries curp_hash and district_hash together, so it is only
 * usable when the request asks for both; everything else uses the basic one.
 */
export function planPresentation(request: M8IdentityRequest, enrollment: WalletEnrollment | null): PresentationPlan {
  if (!enrollment) return { presentable: false, request, reason: 'no-credential' }
  if (enrollment.keyLost) return { presentable: false, request, reason: 'key-unavailable' }

  const requested = new Set(request.requestedElements.map((element) => element.id))
  const wantsLinkable = M8_LINKABLE_IDENTITY_ELEMENTS.some((id) => requested.has(id))
  const credential = wantsLinkable ? enrollment.credential : enrollment.basicCredential
  const held = Object.keys(credential.claims) as M8IdentityElementId[]

  const unrequestedLinkable = held.filter((id) => M8_LINKABLE_IDENTITY_ELEMENTS.includes(id) && !requested.has(id))
  if (unrequestedLinkable.length > 0) {
    return { presentable: false, request, reason: 'linkable-claims-not-requested', missing: unrequestedLinkable }
  }
  const missing = request.requestedElements
    .filter((element) => element.required && !held.includes(element.id))
    .map((element) => element.id)
  if (missing.length > 0) {
    return { presentable: false, request, reason: 'missing-required-claim', missing }
  }

  return {
    presentable: true,
    request,
    credentialKind: wantsLinkable ? 'full' : 'basic',
    credential,
    disclosedClaimIds: held.filter((id) => requested.has(id)),
    revealedClaims: { ...credential.claims },
    unrequestedRevealed: held.filter((id) => !requested.has(id)),
    linkableIdentifiers: {
      subjectDid: credential.subjectDid,
      credentialId: credential.id,
      holderPublicKey: credential.holderPublicKey ?? '',
      revocationHash: credential.revocationHash,
      issuedAt: credential.issuedAt,
    },
  }
}

// ─── Ports ────────────────────────────────────────────────────────────────

export interface WalletSecureStore {
  /**
   * Device-only storage (never synced, never in backups). `userPresence`
   * items can only be read after biometric or passcode confirmation; a read
   * that the device refuses, or of an item that is gone, returns null.
   */
  set(key: string, value: string, options: { userPresence: boolean }): Promise<void>
  get(key: string, options: { userPresence: boolean }): Promise<string | null>
  delete(key: string): Promise<void>
}

export interface WalletBrokerApi {
  get<T>(path: string): Promise<T>
  /** Like get, but null when the broker answers 404; other failures throw. */
  find<T>(path: string): Promise<T | null>
  post<T>(path: string, body?: unknown): Promise<T>
}

export type HolderWalletDeps = {
  store: WalletSecureStore
  api: WalletBrokerApi
  randomBytes: (length: number) => Uint8Array
  now?: () => Date
  /** Pinned issuer public keys (SPKI PEM). Empty: credentials are kept but marked unverified. */
  trustedIssuerKeys?: string[]
}

export type SessionArtifact = { id: string; requestId: string; status: string }

type HolderKeyRecord = {
  keyId: string
  publicKeyPem: string
  state: 'pending' | 'active'
  bindingRequestId: string
  createdAt: string
}

type WalletIndex = { version: 1; keys: HolderKeyRecord[]; enrollments: WalletEnrollment[] }

export class HolderKeyUnavailableError extends Error {
  constructor() {
    super('The wallet key for this credential is unavailable on this device; revoke and enroll again')
    this.name = 'HolderKeyUnavailableError'
  }
}

export class CredentialDeliveryError extends Error {
  constructor(reason: string) {
    super(`Refusing delivered credentials: ${reason}`)
    this.name = 'CredentialDeliveryError'
  }
}

const isActiveIneArtifact = (artifact: SessionArtifact) =>
  artifact.requestId === 'ine-verification' && artifact.status.toLowerCase() === 'active'

export function createHolderWallet(deps: HolderWalletDeps) {
  const now = deps.now ?? (() => new Date())

  async function loadIndex(): Promise<WalletIndex> {
    const raw = await deps.store.get(INDEX_KEY, { userPresence: false })
    return raw ? (JSON.parse(raw) as WalletIndex) : { version: 1, keys: [], enrollments: [] }
  }
  const saveIndex = (index: WalletIndex) =>
    deps.store.set(INDEX_KEY, JSON.stringify(index), { userPresence: false })

  async function forgetKey(index: WalletIndex, keyId: string) {
    await deps.store.delete(privateKeyStoreKey(keyId))
    index.keys = index.keys.filter((key) => key.keyId !== keyId)
    index.enrollments = index.enrollments.filter((enrollment) => enrollment.keyId !== keyId)
  }

  /** The newest enrollment this device can still sign for. */
  function currentEnrollment(index: WalletIndex): WalletEnrollment | null {
    const usable = index.enrollments.filter((enrollment) => !enrollment.keyLost)
    return usable.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))[0] ?? null
  }

  /**
   * Which of the session's active INE enrollments this device can present.
   * `orphaned`: enrolled on another (lost) device or before a restore, so no
   * key here. `keyLost`: held here, but the device no longer releases the key.
   */
  async function assessRecovery(sessionArtifacts: SessionArtifact[]) {
    const index = await loadIndex()
    const active = sessionArtifacts.filter(isActiveIneArtifact).map((artifact) => artifact.id)
    const held = new Map(index.enrollments.map((enrollment) => [enrollment.proofArtifactId, enrollment]))
    return {
      presentable: active.filter((id) => held.has(id) && !held.get(id)!.keyLost),
      keyLost: active.filter((id) => held.get(id)?.keyLost === true),
      orphaned: active.filter((id) => !held.has(id)),
    }
  }

  return {
    async listBindingRequests(): Promise<M8WalletBindingRequest[]> {
      const { requests } = await deps.api.get<{ requests: M8WalletBindingRequest[] }>('/identity/wallet/binding-requests')
      return requests
    },

    /**
     * After the user approves: a fresh key for this enrollment, stored before
     * anything is sent, then the public key and proof go to the relay.
     */
    async approveBindingRequest(request: M8WalletBindingRequest): Promise<{ keyId: string; publicKeyPem: string }> {
      if (request.status !== 'pending') throw new Error('Binding request is not pending')
      const seed = deps.randomBytes(32)
      if (seed.length !== 32) throw new Error('randomBytes must return 32 bytes')
      const publicKeyPem = holderPublicKeyPem(seed)
      const keyId = bytesToHex(sha256(utf8ToBytes(publicKeyPem))).slice(0, 32)

      await deps.store.set(privateKeyStoreKey(keyId), bytesToHex(seed), { userPresence: true })
      const index = await loadIndex()
      index.keys.push({ keyId, publicKeyPem, state: 'pending', bindingRequestId: request.id, createdAt: now().toISOString() })
      await saveIndex(index)

      try {
        await deps.api.post(`/identity/wallet/binding-requests/${request.id}/fulfill`, {
          holderPublicKey: publicKeyPem,
          holderKeyProof: signHolderBinding(seed, request.issuanceChallenge),
        })
      } catch (error) {
        const current = await loadIndex()
        await forgetKey(current, keyId)
        await saveIndex(current)
        throw error
      }
      return { keyId, publicKeyPem }
    },

    async declineBindingRequest(id: string): Promise<void> {
      await deps.api.post(`/identity/wallet/binding-requests/${id}/decline`)
    },

    /** Takes the issued credentials for a binding this device made, once. */
    async collectCredentials(bindingRequestId: string): Promise<WalletEnrollment> {
      const index = await loadIndex()
      const key = index.keys.find((k) => k.bindingRequestId === bindingRequestId && k.state === 'pending')
      if (!key) throw new CredentialDeliveryError('no pending key for this binding on this device')

      const delivery = await deps.api.post<M8WalletCredentialDelivery>(
        `/identity/wallet/binding-requests/${bindingRequestId}/collect`,
      )
      for (const credential of [delivery.credential, delivery.basicCredential]) {
        if (credential.holderPublicKey?.trim() !== key.publicKeyPem) {
          throw new CredentialDeliveryError('credential is bound to a different holder key')
        }
      }
      const pinned = deps.trustedIssuerKeys ?? []
      const issuerVerified = pinned.length > 0
      if (issuerVerified) {
        const signedByPinned = (credential: M8IdentityCredential) =>
          pinned.some((pem) => verifyCredentialIssuer(credential, pem))
        if (!signedByPinned(delivery.credential) || !signedByPinned(delivery.basicCredential)) {
          throw new CredentialDeliveryError('issuer signature does not match a pinned issuer key')
        }
      }

      const enrollment: WalletEnrollment = {
        proofArtifactId: delivery.proofArtifactId,
        keyId: key.keyId,
        credential: delivery.credential,
        basicCredential: delivery.basicCredential,
        issuerVerified,
        collectedAt: now().toISOString(),
      }
      key.state = 'active'
      index.enrollments.push(enrollment)
      await saveIndex(index)
      return enrollment
    },

    /** Live requests, each with exactly what presenting it would reveal. */
    async listPresentationPlans(): Promise<PresentationPlan[]> {
      const index = await loadIndex()
      const { requests } = await deps.api.get<{ requests: M8IdentityRequest[] }>('/identity/requests')
      const enrollment = currentEnrollment(index)
      return requests.map((request) => planPresentation(request, enrollment))
    },

    /** After the user approves a plan: sign on the device, submit to mubEZ. */
    async present(request: M8IdentityRequest): Promise<M8IdentityVerificationResult> {
      const index = await loadIndex()
      const enrollment = currentEnrollment(index)
      const plan = planPresentation(request, enrollment)
      if (!plan.presentable) throw new Error(`Cannot present: ${plan.reason}`)

      const stored = await deps.store.get(privateKeyStoreKey(enrollment!.keyId), { userPresence: true })
      if (!stored) {
        enrollment!.keyLost = true
        await saveIndex(index)
        throw new HolderKeyUnavailableError()
      }
      const issuedAt = now()
      const presentation = signPresentation(hexToBytes(stored), {
        request,
        credential: plan.credential,
        disclosedClaimIds: plan.disclosedClaimIds,
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + PRESENTATION_TTL_MS).toISOString(),
      })
      return deps.api.post<M8IdentityVerificationResult>('/identity/verify', { requestId: request.id, presentation })
    },

    async declineRequest(requestId: string): Promise<void> {
      await deps.api.post(`/identity/request/${requestId}/decline`)
    },

    async enrollments(): Promise<WalletEnrollment[]> {
      return (await loadIndex()).enrollments
    },

    /**
     * Which of the session's active INE enrollments this device can present.
     * `orphaned`: enrolled on another (lost) device or before a restore, so no
     * key here. `keyLost`: held here, but the device no longer releases the key.
     */
    assessRecovery,

    /**
     * Device loss or key loss: revoke every active enrollment this device
     * cannot present, then drop local state for it. The user enrolls again
     * through PARA afterwards. Irreversible, and voting eligibility pauses
     * until the new enrollment: the approval screen must say so.
     */
    async recoverAfterDeviceLoss(sessionArtifacts: SessionArtifact[]): Promise<{ revoked: string[] }> {
      const { keyLost, orphaned } = await assessRecovery(sessionArtifacts)
      const revoked: string[] = []
      for (const proofArtifactId of [...orphaned, ...keyLost]) {
        await deps.api.post('/identity/revoke', { proofArtifactId, reason: 'Wallet key lost or device replaced' })
        revoked.push(proofArtifactId)
      }
      const index = await loadIndex()
      for (const enrollment of index.enrollments.filter((e) => keyLost.includes(e.proofArtifactId))) {
        await forgetKey(index, enrollment.keyId)
      }
      await saveIndex(index)
      return { revoked }
    },

    /** User-initiated revocation: the server first, then the key and credentials here. */
    async revokeEnrollment(proofArtifactId: string): Promise<void> {
      const index = await loadIndex()
      const enrollment = index.enrollments.find((e) => e.proofArtifactId === proofArtifactId)
      await deps.api.post('/identity/revoke', { proofArtifactId })
      if (enrollment) {
        await forgetKey(index, enrollment.keyId)
        await saveIndex(index)
      }
    },

    /** Deletes keys generated for bindings that were declined or expired unused. */
    async pruneAbandonedKeys(): Promise<string[]> {
      const index = await loadIndex()
      const pruned: string[] = []
      for (const key of index.keys.filter((k) => k.state === 'pending')) {
        // An outage throws out of here: only a definite answer deletes a key.
        const found = await deps.api.find<M8WalletBindingRequest>(`/identity/wallet/binding-requests/${key.bindingRequestId}`)
        const status = found?.status ?? 'gone'
        if (status === 'gone' || status === 'declined' || status === 'collected') {
          await forgetKey(index, key.keyId)
          pruned.push(key.keyId)
        }
      }
      await saveIndex(index)
      return pruned
    },
  }
}

export type HolderWallet = ReturnType<typeof createHolderWallet>
