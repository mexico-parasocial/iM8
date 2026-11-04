import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hexToBytes } from '@noble/curves/abstract/utils'
import {
  HOLDER_WALLET_ENABLED,
  HolderKeyUnavailableError,
  canonicalJson,
  createHolderWallet,
  credentialSignedPayload,
  ed25519PublicKeyFromPem,
  holderPublicKeyPem,
  planPresentation,
  signHolderBinding,
  signPresentation,
  verifyCredentialIssuer,
  type WalletBrokerApi,
  type WalletEnrollment,
  type WalletSecureStore,
} from '../holderWallet'
import {
  m8HolderBindingMessage,
  type M8IdentityCredential,
  type M8IdentityRequest,
  type M8WalletPresentation,
} from '../../contracts/identityWallet'

/*
 * The iM8 holder wallet against (1) mubEZ's conformance vectors — Ed25519 is
 * deterministic, so every byte must match — and (2) an in-memory broker that
 * checks signatures with Node's own Ed25519, independently of the wallet's
 * noble implementation.
 */

const here = dirname(fileURLToPath(import.meta.url))
const vectors = JSON.parse(readFileSync(join(here, 'wallet-presentation-vectors.json'), 'utf8'))

// ─── Conformance with mubEZ ───────────────────────────────────────────────

describe('holder wallet conformance vectors', () => {
  const seed = hexToBytes(vectors.holder.seed)

  it('encodes the holder public key exactly as mubEZ does', () => {
    assert.equal(holderPublicKeyPem(seed), vectors.holder.publicKeyPem)
    assert.ok(ed25519PublicKeyFromPem(vectors.holder.publicKeyPem))
    assert.equal(ed25519PublicKeyFromPem('-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----'), null)
  })

  it('reproduces the binding proof byte for byte', () => {
    assert.equal(m8HolderBindingMessage(vectors.binding.issuanceChallenge), vectors.binding.message)
    assert.equal(signHolderBinding(seed, vectors.binding.issuanceChallenge), vectors.binding.proof)
  })

  it('canonicalizes the credential and verifies its issuer signature', () => {
    const { signature: _s, ...unsigned } = vectors.credential.value
    assert.equal(credentialSignedPayload(unsigned), vectors.credential.canonicalPayload)
    assert.equal(verifyCredentialIssuer(vectors.credential.value, vectors.issuer.publicKeyPem), true)
    const tampered = { ...vectors.credential.value, claims: { ...vectors.credential.value.claims, age_over_21: true } }
    assert.equal(verifyCredentialIssuer(tampered, vectors.issuer.publicKeyPem), false)
    assert.equal(verifyCredentialIssuer(vectors.credential.value, vectors.holder.publicKeyPem), false)
  })

  it('reproduces the presentation and its signature byte for byte', () => {
    const presentation = signPresentation(seed, {
      request: vectors.request,
      credential: vectors.credential.value,
      disclosedClaimIds: vectors.presentation.disclosedClaimIds,
      issuedAt: vectors.presentation.value.issuedAt,
      expiresAt: vectors.presentation.value.expiresAt,
    })
    const { signature, ...unsigned } = presentation
    assert.equal(canonicalJson(unsigned), vectors.presentation.canonicalPayload)
    assert.equal(signature, vectors.presentation.value.signature)
    assert.deepEqual(presentation, vectors.presentation.value)
  })
})

// ─── In-memory device and broker ──────────────────────────────────────────

class MemoryStore implements WalletSecureStore {
  items = new Map<string, { value: string; userPresence: boolean }>()
  presencePrompts = 0
  refuse = new Set<string>()
  async set(key: string, value: string, options: { userPresence: boolean }) {
    this.items.set(key, { value, userPresence: options.userPresence })
  }
  async get(key: string, options: { userPresence: boolean }) {
    const item = this.items.get(key)
    if (!item) return null
    if (item.userPresence) {
      if (!options.userPresence) return null
      this.presencePrompts += 1
      if (this.refuse.has(key)) return null
    }
    return item.value
  }
  async delete(key: string) {
    this.items.delete(key)
  }
}

const b64url = (bytes: Buffer) => bytes.toString('base64url')

/**
 * Enough of mubEZ's relay and verifier to exercise the wallet: binding with
 * possession check, issuance into the mailbox, collection once, identity
 * requests, v2 verification, revocation by artifact id.
 */
class FakeBroker implements WalletBrokerApi {
  issuer = generateKeyPairSync('ed25519')
  issuerPem = this.issuer.publicKey.export({ type: 'spki', format: 'pem' }).toString().trim()
  subjectDid = 'did:plc:walletholderaaaaaaaaaaaaa'
  bindings = new Map<string, { id: string; issuanceChallenge: string; status: string; holderPublicKey?: string; delivery?: unknown }>()
  requests = new Map<string, M8IdentityRequest>()
  artifacts: Array<{ id: string; requestId: string; status: string; revocationHash: string }> = []
  bodies: string[] = []
  down = false
  counter = 0

  private sessionArtifactsView = () => this.artifacts.map(({ id, requestId, status }) => ({ id, requestId, status }))
  sessionArtifacts() {
    return this.sessionArtifactsView()
  }

  openBinding() {
    const id = `wallet-binding-${++this.counter}`
    const binding = { id, issuanceChallenge: b64url(randomBytes(32)), status: 'pending' }
    this.bindings.set(id, binding)
    return binding as { id: string; issuanceChallenge: string; status: 'pending'; createdAt: string; expiresAt: string }
  }

  private issueCredential(holderPublicKey: string, claims: M8IdentityCredential['claims'], revocationHash: string) {
    const unsigned: Omit<M8IdentityCredential, 'signature'> = {
      id: `credential-${++this.counter}`,
      issuerDid: 'did:m8:ine:fake',
      issuerKeyId: 'fake-key',
      subjectDid: this.subjectDid,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400_000).toISOString(),
      claims,
      revocationHash,
      holderPublicKey,
      signatureAlg: 'Ed25519',
    }
    return { ...unsigned, signature: b64url(sign(null, Buffer.from(credentialSignedPayload(unsigned)), this.issuer.privateKey)) }
  }

  /** PARA's issuance against a bound request: credentials go to the mailbox. */
  issueAgainst(bindingId: string, holderOverride?: string) {
    const binding = this.bindings.get(bindingId)!
    assert.equal(binding.status, 'bound')
    const holder = holderOverride ?? binding.holderPublicKey!
    const revocationHash = b64url(randomBytes(16))
    const proofArtifactId = `proof-ine-${++this.counter}`
    this.artifacts.push({ id: proofArtifactId, requestId: 'ine-verification', status: 'active', revocationHash })
    binding.status = 'issued'
    binding.delivery = {
      proofArtifactId,
      credential: this.issueCredential(holder, { age_over_18: true, age_over_21: false, citizenship: 'MX', district_hash: 'hmac:d', curp_hash: 'hmac:c' }, revocationHash),
      basicCredential: this.issueCredential(holder, { age_over_18: true, citizenship: 'MX' }, revocationHash),
    }
    return proofArtifactId
  }

  addRequest(elements: Array<{ id: M8IdentityRequest['requestedElements'][number]['id']; required: boolean }>) {
    const request: M8IdentityRequest = {
      id: `identity-request-${++this.counter}`,
      sessionId: 'session',
      nonce: b64url(randomBytes(32)),
      audienceAppId: 'para.test',
      audienceAppName: 'PARA test',
      purpose: 'test',
      merchantIdentifier: 'merchant',
      requestedElements: elements.map((e) => ({ ...e, intentToStore: { mode: 'will-not-store' } })),
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      usedAt: null,
    }
    this.requests.set(request.id, request)
    return request
  }

  private verify(requestId: string, presentation: M8WalletPresentation) {
    const errors: string[] = []
    const request = this.requests.get(requestId)!
    if (request.status !== 'active') errors.push('identity request is not active')
    if (presentation.type !== 'm8.identity.presentation.v2') errors.push('type')
    if (presentation.nonce !== request.nonce) errors.push('nonce')
    const { signature, ...unsigned } = presentation
    const holderOk = verify(null, Buffer.from(canonicalJson(unsigned)), presentation.credential.holderPublicKey!, Buffer.from(signature, 'base64url'))
    if (!holderOk) errors.push('wallet presentation signature is invalid')
    const { signature: issuerSig, ...credential } = presentation.credential
    if (!verify(null, Buffer.from(credentialSignedPayload(credential)), this.issuerPem, Buffer.from(issuerSig, 'base64url'))) {
      errors.push('credential issuer signature is invalid')
    }
    const artifact = this.artifacts.find((a) => a.revocationHash === presentation.credential.revocationHash)
    if (artifact?.status !== 'active') errors.push(`credential is ${artifact?.status ?? 'unknown'}`)
    const requested = new Set(request.requestedElements.map((e) => e.id))
    for (const id of Object.keys(presentation.credential.claims)) {
      if (!requested.has(id as never) && (id === 'curp_hash' || id === 'district_hash')) errors.push(`linkable ${id}`)
    }
    if (errors.length === 0) request.status = 'used'
    return { valid: errors.length === 0, errors, disclosedClaims: errors.length === 0 ? presentation.disclosedClaims : {} }
  }

  async get<T>(path: string): Promise<T> {
    if (this.down) throw new Error('network down')
    if (path === '/identity/wallet/binding-requests') {
      return { requests: [...this.bindings.values()].filter((b) => b.status === 'pending' || b.status === 'issued') } as T
    }
    if (path === '/identity/requests') {
      return { requests: [...this.requests.values()].filter((r) => r.status === 'active') } as T
    }
    const binding = this.bindings.get(path.split('/').pop()!)
    if (binding) return { ...binding, holderPublicKey: undefined, delivery: undefined } as T
    throw Object.assign(new Error('not found'), { status: 404 })
  }

  async find<T>(path: string): Promise<T | null> {
    try {
      return await this.get<T>(path)
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null
      throw error
    }
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    if (this.down) throw new Error('network down')
    this.bodies.push(JSON.stringify(body ?? null))
    const match = /^\/identity\/wallet\/binding-requests\/([^/]+)\/(fulfill|decline|collect)$/.exec(path)
    if (match) {
      const binding = this.bindings.get(match[1])
      if (!binding) throw Object.assign(new Error('not-found'), { status: 404 })
      if (match[2] === 'fulfill') {
        const { holderPublicKey, holderKeyProof } = body as { holderPublicKey: string; holderKeyProof: string }
        const ok = verify(null, Buffer.from(m8HolderBindingMessage(binding.issuanceChallenge)), holderPublicKey, Buffer.from(holderKeyProof, 'base64url'))
        if (binding.status !== 'pending' || !ok) throw Object.assign(new Error('invalid-proof'), { status: 400 })
        binding.status = 'bound'
        binding.holderPublicKey = holderPublicKey.trim()
        return { status: 'bound' } as T
      }
      if (match[2] === 'decline') {
        binding.status = 'declined'
        return { status: 'declined' } as T
      }
      if (binding.status !== 'issued') throw Object.assign(new Error('nothing to collect'), { status: 404 })
      binding.status = 'collected'
      const delivery = binding.delivery
      binding.delivery = undefined
      return delivery as T
    }
    if (path === '/identity/verify') {
      const { requestId, presentation } = body as { requestId: string; presentation: M8WalletPresentation }
      return this.verify(requestId, presentation) as T
    }
    if (path === '/identity/revoke') {
      const { proofArtifactId } = body as { proofArtifactId: string }
      const artifact = this.artifacts.find((a) => a.id === proofArtifactId)!
      artifact.status = 'revoked'
      return { revoked: true } as T
    }
    const decline = /^\/identity\/request\/([^/]+)\/decline$/.exec(path)
    if (decline) {
      this.requests.get(decline[1])!.status = 'declined'
      return { status: 'declined' } as T
    }
    throw new Error(`unexpected POST ${path}`)
  }
}

function setup(options: { pinIssuer?: boolean } = {}) {
  const broker = new FakeBroker()
  const store = new MemoryStore()
  const wallet = createHolderWallet({
    store,
    api: broker,
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
    trustedIssuerKeys: options.pinIssuer === false ? [] : [broker.issuerPem],
  })
  return { broker, store, wallet }
}

async function enroll(ctx: ReturnType<typeof setup>) {
  const binding = ctx.broker.openBinding()
  const { keyId, publicKeyPem } = await ctx.wallet.approveBindingRequest(binding)
  const proofArtifactId = ctx.broker.issueAgainst(binding.id)
  const enrollment = await ctx.wallet.collectCredentials(binding.id)
  return { binding, keyId, publicKeyPem, proofArtifactId, enrollment }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

describe('holder wallet key lifecycle', () => {
  it('stays gated', () => {
    assert.equal(HOLDER_WALLET_ENABLED, false)
  })

  it('generates the key on the device, behind user presence, and sends only public material', async () => {
    const ctx = setup()
    const { keyId, publicKeyPem } = await enroll(ctx)

    const keyItem = ctx.store.items.get(`m8.wallet.holder.key.${keyId}`)!
    assert.equal(keyItem.userPresence, true)
    assert.match(keyItem.value, /^[0-9a-f]{64}$/)
    assert.equal(holderPublicKeyPem(hexToBytes(keyItem.value)), publicKeyPem)

    const seed = Buffer.from(keyItem.value, 'hex')
    for (const body of ctx.broker.bodies) {
      assert.ok(!body.includes(keyItem.value), 'private key (hex) never leaves the device')
      assert.ok(!body.includes(seed.toString('base64')), 'private key (base64) never leaves the device')
      assert.ok(!body.includes(seed.toString('base64url')), 'private key (base64url) never leaves the device')
    }
    // Keys are per enrollment: a second one gets a different key.
    const second = await enroll(ctx)
    assert.notEqual(second.publicKeyPem, publicKeyPem)
  })

  it('discards the key when the relay refuses the binding', async () => {
    const ctx = setup()
    const binding = ctx.broker.openBinding()
    ctx.broker.bindings.get(binding.id)!.status = 'declined'
    await assert.rejects(ctx.wallet.approveBindingRequest(binding))
    const keys = [...ctx.store.items.keys()].filter((k) => k.startsWith('m8.wallet.holder.key.'))
    assert.deepEqual(keys, [])
  })

  it('refuses delivered credentials bound to another key or signed by an unpinned issuer', async () => {
    const ctx = setup()
    const binding = ctx.broker.openBinding()
    await ctx.wallet.approveBindingRequest(binding)
    const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString().trim()
    ctx.broker.issueAgainst(binding.id, other)
    await assert.rejects(ctx.wallet.collectCredentials(binding.id), /different holder key/)
    assert.deepEqual(await ctx.wallet.enrollments(), [])

    const unpinned = setup()
    unpinned.broker.issuerPem = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString().trim()
    const wallet = createHolderWallet({
      store: unpinned.store, api: unpinned.broker, randomBytes: (n) => new Uint8Array(randomBytes(n)),
      trustedIssuerKeys: [unpinned.broker.issuerPem],
    })
    const b2 = unpinned.broker.openBinding()
    await wallet.approveBindingRequest(b2)
    unpinned.broker.issueAgainst(b2.id)
    await assert.rejects(wallet.collectCredentials(b2.id), /pinned issuer key/)

    const noPin = setup({ pinIssuer: false })
    const { enrollment } = await enroll(noPin)
    assert.equal(enrollment.issuerVerified, false)
  })

  it('presents the basic credential to an age-only request, signed after user presence', async () => {
    const ctx = setup()
    await enroll(ctx)
    const request = ctx.broker.addRequest([{ id: 'age_over_18', required: true }])

    const [plan] = await ctx.wallet.listPresentationPlans()
    assert.equal(plan.presentable, true)
    if (!plan.presentable) return
    assert.equal(plan.credentialKind, 'basic')
    assert.deepEqual(plan.revealedClaims, { age_over_18: true, citizenship: 'MX' })
    assert.deepEqual(plan.unrequestedRevealed, ['citizenship'])
    assert.equal(plan.linkableIdentifiers.subjectDid, ctx.broker.subjectDid)
    assert.ok(plan.linkableIdentifiers.holderPublicKey.includes('BEGIN PUBLIC KEY'))

    const prompts = ctx.store.presencePrompts
    const result = await ctx.wallet.present(request)
    assert.deepEqual(result.errors, [])
    assert.equal(result.valid, true)
    assert.equal(ctx.store.presencePrompts, prompts + 1)

    // Replay of the same request fails at the broker.
    const replay = await ctx.wallet.present(request)
    assert.equal(replay.valid, false)
    assert.ok(replay.errors.includes('identity request is not active'))
  })

  it('plans honestly: identifiers only when both are asked, missing claims refused', () => {
    const enrollment = {
      proofArtifactId: 'p', keyId: 'k', issuerVerified: true, collectedAt: '2026-01-01T00:00:00.000Z',
      credential: { claims: { age_over_18: true, age_over_21: false, citizenship: 'MX', district_hash: 'd', curp_hash: 'c' } },
      basicCredential: { claims: { age_over_18: true, citizenship: 'MX' } },
    } as unknown as WalletEnrollment
    const req = (ids: Array<[M8IdentityRequest['requestedElements'][number]['id'], boolean]>) =>
      ({ requestedElements: ids.map(([id, required]) => ({ id, required, intentToStore: { mode: 'will-not-store' } })) }) as M8IdentityRequest

    const curpOnly = planPresentation(req([['curp_hash', true]]), enrollment)
    assert.equal(curpOnly.presentable, false)
    assert.equal(!curpOnly.presentable && curpOnly.reason, 'linkable-claims-not-requested')

    const both = planPresentation(req([['curp_hash', true], ['district_hash', false], ['age_over_18', true]]), enrollment)
    assert.equal(both.presentable && both.credentialKind, 'full')
    assert.deepEqual(both.presentable && both.unrequestedRevealed, ['age_over_21', 'citizenship'])

    const over21 = planPresentation(req([['age_over_21', true]]), enrollment)
    assert.equal(!over21.presentable && over21.reason, 'missing-required-claim')

    assert.equal(planPresentation(req([['age_over_18', true]]), null).presentable, false)
  })

  it('lets the user decline a request', async () => {
    const ctx = setup()
    await enroll(ctx)
    const request = ctx.broker.addRequest([{ id: 'age_over_18', required: true }])
    await ctx.wallet.declineRequest(request.id)
    assert.equal(ctx.broker.requests.get(request.id)!.status, 'declined')
  })

  it('recovers from device loss: the new device revokes what it cannot present', async () => {
    const lost = setup()
    const { proofArtifactId } = await enroll(lost)

    // Replacement device: same account and broker, empty device storage.
    const replacement = createHolderWallet({
      store: new MemoryStore(), api: lost.broker, randomBytes: (n) => new Uint8Array(randomBytes(n)),
      trustedIssuerKeys: [lost.broker.issuerPem],
    })
    const assessment = await replacement.assessRecovery(lost.broker.sessionArtifacts())
    assert.deepEqual(assessment.orphaned, [proofArtifactId])
    assert.deepEqual(assessment.presentable, [])

    const { revoked } = await replacement.recoverAfterDeviceLoss(lost.broker.sessionArtifacts())
    assert.deepEqual(revoked, [proofArtifactId])

    // Whoever has the lost phone and its key can no longer pass a gate.
    const stolenUse = await lost.wallet.present(lost.broker.addRequest([{ id: 'age_over_18', required: true }]))
    assert.equal(stolenUse.valid, false)
    assert.ok(stolenUse.errors.includes('credential is revoked'))

    // Re-enrollment on the replacement binds a new key and works.
    const binding = lost.broker.openBinding()
    await replacement.approveBindingRequest(binding)
    lost.broker.issueAgainst(binding.id)
    await replacement.collectCredentials(binding.id)
    const fresh = await replacement.present(lost.broker.addRequest([{ id: 'age_over_18', required: true }]))
    assert.equal(fresh.valid, true)
  })

  it('reports a key the device no longer releases, and recovers from it', async () => {
    const ctx = setup()
    const { keyId, proofArtifactId } = await enroll(ctx)
    ctx.store.refuse.add(`m8.wallet.holder.key.${keyId}`) // e.g. biometrics re-enrolled

    await assert.rejects(ctx.wallet.present(ctx.broker.addRequest([{ id: 'age_over_18', required: true }])), HolderKeyUnavailableError)
    const assessment = await ctx.wallet.assessRecovery(ctx.broker.sessionArtifacts())
    assert.deepEqual(assessment.keyLost, [proofArtifactId])

    const [plan] = await ctx.wallet.listPresentationPlans()
    assert.equal(!plan.presentable && plan.reason, 'no-credential')

    const { revoked } = await ctx.wallet.recoverAfterDeviceLoss(ctx.broker.sessionArtifacts())
    assert.deepEqual(revoked, [proofArtifactId])
    assert.equal(ctx.store.items.has(`m8.wallet.holder.key.${keyId}`), false)
    assert.deepEqual(await ctx.wallet.enrollments(), [])
  })

  it('revokes on the server first, then erases the key and credentials', async () => {
    const ctx = setup()
    const { keyId, proofArtifactId } = await enroll(ctx)
    await ctx.wallet.revokeEnrollment(proofArtifactId)
    assert.equal(ctx.broker.artifacts.find((a) => a.id === proofArtifactId)!.status, 'revoked')
    assert.equal(ctx.store.items.has(`m8.wallet.holder.key.${keyId}`), false)
    assert.deepEqual(await ctx.wallet.enrollments(), [])

    // If the server is unreachable, nothing local is erased.
    const offline = setup()
    const held = await enroll(offline)
    offline.broker.down = true
    await assert.rejects(offline.wallet.revokeEnrollment(held.proofArtifactId))
    assert.equal(offline.store.items.has(`m8.wallet.holder.key.${held.keyId}`), true)
  })

  it('prunes keys for abandoned bindings, but not during an outage', async () => {
    const ctx = setup()
    const declined = ctx.broker.openBinding()
    const kept = ctx.broker.openBinding()
    const { keyId: declinedKey } = await ctx.wallet.approveBindingRequest(declined)
    const { keyId: keptKey } = await ctx.wallet.approveBindingRequest(kept)
    ctx.broker.bindings.get(declined.id)!.status = 'declined'

    ctx.broker.down = true
    await assert.rejects(ctx.wallet.pruneAbandonedKeys())
    assert.equal(ctx.store.items.has(`m8.wallet.holder.key.${declinedKey}`), true)

    ctx.broker.down = false
    assert.deepEqual(await ctx.wallet.pruneAbandonedKeys(), [declinedKey])
    assert.equal(ctx.store.items.has(`m8.wallet.holder.key.${declinedKey}`), false)
    assert.equal(ctx.store.items.has(`m8.wallet.holder.key.${keptKey}`), true)

    ctx.broker.bindings.delete(kept.id) // expired on the broker
    assert.deepEqual(await ctx.wallet.pruneAbandonedKeys(), [keptKey])
  })
})
