import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const tmpDir = mkdtempSync(join(tmpdir(), 'm8-zkp-test-'))
process.env.DATABASE_PATH = join(tmpDir, 'zkp-test.db')

describe('ZKP age proof integration', () => {
  let app: FastifyInstance
  let accessToken: string

  before(async () => {
    const { buildApp } = await import('../../src/index.js')
    app = await buildApp()
    const start = await app.inject({
      method: 'POST',
      url: '/v1/sessions/start',
      payload: { identifier: 'zkpuser.bsky.social' },
    })
    const body = JSON.parse(start.payload)
    accessToken = body.tokens.accessToken
  })

  after(async () => {
    await app.close()
  })

  it('POST /v1/identity/ine/zkp-verify accepts a valid client-generated proof', async () => {
    // 1. Issue a credential to get a registered commitment
    const analyze = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-zkp-valid', simulatedMode: true },
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

    // 2. Simulate client-side proof generation using the credential's witness
    const { generateAgeProof } = await import('../../src/services/zkpService.js')
    const { proof, publicSignals } = await generateAgeProof({
      birthYear: credential.birthYear,
      salt: credential.salt,
      currentYear: 2026,
      ageThreshold: 18,
    })

    // 3. Verify the proof server-side
    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/zkp-verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { proof, publicSignals },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.valid, true)
    assert.equal(body.commitment, credential.commitment)
  })

  it('rejects a proof with tampered public signals', async () => {
    const { generateAgeProof } = await import('../../src/services/zkpService.js')
    const { proof, publicSignals } = await generateAgeProof({
      birthYear: 1990,
      salt: 555666,
      currentYear: 2026,
      ageThreshold: 18,
    })

    const tamperedSignals = [...publicSignals]
    tamperedSignals[0] = '12345678901234567890123456789012345678901234567890'

    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/zkp-verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { proof, publicSignals: tamperedSignals },
    })

    assert.equal(res.statusCode, 400)
    const body = JSON.parse(res.payload)
    assert.equal(body.valid, false)
  })

  it('rejects a proof for a revoked credential', async () => {
    // 1. Issue a credential
    const analyze = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-zkp-revoke', simulatedMode: true },
    })
    const { extracted } = JSON.parse(analyze.payload)

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, selfieBase64: 'mock-selfie-revoke', consentToStore: true },
    })
    const verification = JSON.parse(verify.payload)

    const credRes = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/credential',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, verification },
    })
    const credential = JSON.parse(credRes.payload)

    // 2. Generate proof using the same birthYear + salt from the credential
    const { generateAgeProof } = await import('../../src/services/zkpService.js')
    const { proof, publicSignals } = await generateAgeProof({
      birthYear: credential.birthYear,
      salt: credential.salt,
      currentYear: 2026,
      ageThreshold: 18,
    })

    // 3. Revoke the credential
    const revokeRes = await app.inject({
      method: 'POST',
      url: '/v1/identity/revoke',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { revocationHash: credential.revocationHash, reason: 'Test revocation' },
    })
    assert.equal(revokeRes.statusCode, 200)

    // 4. Verify the proof — should fail because credential is revoked
    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/zkp-verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { proof, publicSignals },
    })

    assert.equal(res.statusCode, 400)
    const body = JSON.parse(res.payload)
    assert.equal(body.valid, false)
    assert.equal(body.reason, 'credential_revoked')
  })

  it('GET /v1/identity/crl returns revoked hashes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/identity/crl',
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.ok(Array.isArray(body.revokedHashes))
    assert.ok(body.revokedHashes.length >= 1)
    assert.ok(body.updatedAt)
  })
})
