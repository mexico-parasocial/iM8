import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const tmpDir = mkdtempSync(join(tmpdir(), 'm8-nullifier-test-'))
process.env.DATABASE_PATH = join(tmpDir, 'nullifier-test.db')

describe('Nullifier ZKP integration', () => {
  let app: FastifyInstance
  let accessToken: string

  before(async () => {
    const { buildApp } = await import('../../src/index.js')
    app = await buildApp()
    const start = await app.inject({
      method: 'POST',
      url: '/v1/sessions/start',
      payload: { identifier: 'nullifieruser.bsky.social' },
    })
    const body = JSON.parse(start.payload)
    accessToken = body.tokens.accessToken
  })

  after(async () => {
    await app.close()
  })

  it('POST /v1/identity/ine/zkp-nullifier accepts a valid nullifier proof', async () => {
    // 1. Issue a credential
    const analyze = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-nullifier-valid', simulatedMode: true },
    })
    const { extracted } = JSON.parse(analyze.payload)

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, selfieBase64: 'mock-selfie-valid', consentToStore: true },
    })
    const verification = JSON.parse(verify.payload)

    const credRes = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/credential',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, verification },
    })
    const credential = JSON.parse(credRes.payload)

    // 2. Generate nullifier proof client-side
    const { generateNullifierProof } = await import('../../src/services/zkpService.js')
    const { proof, publicSignals, nullifier } = await generateNullifierProof({
      birthYear: credential.birthYear,
      salt: credential.salt,
      communityId: 42,
      currentYear: 2026,
      ageThreshold: 18,
    })

    // 3. Submit nullifier to backend
    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/zkp-nullifier',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { proof, publicSignals, communityId: '42' },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.valid, true)
    assert.equal(body.commitment, credential.commitment)
    assert.equal(body.nullifier, nullifier)
  })

  it('rejects a reused nullifier for the same community', async () => {
    // Use the same credential as before
    const analyze = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-nullifier-reuse', simulatedMode: true },
    })
    const { extracted } = JSON.parse(analyze.payload)

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, selfieBase64: 'mock-selfie-reuse', consentToStore: true },
    })
    const verification = JSON.parse(verify.payload)

    const credRes = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/credential',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, verification },
    })
    const credential = JSON.parse(credRes.payload)

    // Generate and submit first nullifier
    const { generateNullifierProof } = await import('../../src/services/zkpService.js')
    const { proof, publicSignals } = await generateNullifierProof({
      birthYear: credential.birthYear,
      salt: credential.salt,
      communityId: 99,
      currentYear: 2026,
      ageThreshold: 18,
    })

    const first = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/zkp-nullifier',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { proof, publicSignals, communityId: '99' },
    })
    assert.equal(first.statusCode, 200)

    // Try to reuse the same nullifier
    const second = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/zkp-nullifier',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { proof, publicSignals, communityId: '99' },
    })

    assert.equal(second.statusCode, 400)
    const body = JSON.parse(second.payload)
    assert.equal(body.valid, false)
    assert.equal(body.reason, 'nullifier_already_used')
  })

  it('rejects a nullifier proof with community mismatch', async () => {
    const analyze = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-nullifier-mismatch', simulatedMode: true },
    })
    const { extracted } = JSON.parse(analyze.payload)

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, selfieBase64: 'mock-selfie-mismatch', consentToStore: true },
    })
    const verification = JSON.parse(verify.payload)

    const credRes = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/credential',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, verification },
    })
    const credential = JSON.parse(credRes.payload)

    const { generateNullifierProof } = await import('../../src/services/zkpService.js')
    const { proof, publicSignals } = await generateNullifierProof({
      birthYear: credential.birthYear,
      salt: credential.salt,
      communityId: 7,
      currentYear: 2026,
      ageThreshold: 18,
    })

    // Submit with wrong communityId
    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/zkp-nullifier',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { proof, publicSignals, communityId: '99' },
    })

    assert.equal(res.statusCode, 400)
    const body = JSON.parse(res.payload)
    assert.equal(body.valid, false)
    assert.equal(body.reason, 'community_mismatch')
  })
})
