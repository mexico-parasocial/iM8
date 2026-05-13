import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const tmpDir = mkdtempSync(join(tmpdir(), 'm8-test-'))
process.env.DATABASE_PATH = join(tmpDir, 'ine-test.db')

describe('INE verification integration', () => {
  let app: FastifyInstance
  let accessToken: string

  before(async () => {
    const { buildApp } = await import('../../src/index.js')
    app = await buildApp()
    const start = await app.inject({
      method: 'POST',
      url: '/v1/sessions/start',
      payload: { identifier: 'ineuser.bsky.social' },
    })
    const body = JSON.parse(start.payload)
    accessToken = body.tokens.accessToken
  })

  after(async () => {
    await app.close()
  })

  it('POST /v1/identity/ine/analyze extracts INE data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-ine-photo-123', simulatedMode: true },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.ok(body.extracted)
    assert.ok(body.extracted.fullName)
    assert.ok(body.extracted.curp)
    assert.ok(body.extracted.curp.length >= 18)
    assert.ok(body.extracted.voterId)
    assert.ok(body.extracted.birthDate)
    assert.ok(['M', 'F'].includes(body.extracted.gender))
    assert.ok(body.extracted.address)
    assert.ok(body.extracted.address.state)
    assert.ok(body.ocrConfidence >= 0.9 && body.ocrConfidence <= 1.0)
    assert.equal(body.extractionStatus, 'complete')
  })

  it('POST /v1/identity/ine/verify performs face match and RENAPO', async () => {
    const analyze = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-ine-photo-456', simulatedMode: true },
    })
    const { extracted } = JSON.parse(analyze.payload)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, selfieBase64: 'mock-selfie-456', consentToStore: true },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.ok(typeof body.faceMatch.score === 'number')
    assert.ok(body.faceMatch.score >= 0 && body.faceMatch.score <= 1)
    assert.ok(typeof body.faceMatch.passed === 'boolean')
    assert.ok(['active', 'deceased', 'not-found', 'duplicate'].includes(body.renapo.status))
    assert.equal(body.renapo.citizenship, 'MX')
    assert.ok(['verified', 'rejected', 'manual-review-required'].includes(body.overall))
    assert.ok(body.verificationId)
    assert.ok(body.verifiedAt)
  })

  it('POST /v1/identity/ine/credential issues a signed credential', async () => {
    const analyze = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/analyze',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { inePhotoBase64: 'mock-ine-photo-789', simulatedMode: true },
    })
    const { extracted } = JSON.parse(analyze.payload)

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, selfieBase64: 'mock-selfie-789', consentToStore: true },
    })
    const verification = JSON.parse(verify.payload)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/identity/ine/credential',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { extracted, verification },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.ok(body.credential)
    assert.equal(body.credential.claims.citizenship, 'MX')
    assert.equal(typeof body.credential.claims.age_over_18, 'boolean')
    assert.equal(typeof body.credential.claims.age_over_21, 'boolean')
    assert.ok(body.credential.claims.district_hash.startsWith('sha256:'))
    assert.ok(body.credential.claims.curp_hash.startsWith('sha256:'))
    assert.ok(body.credential.issuedAt)
    assert.ok(body.credential.expiresAt)
    assert.ok(body.proofArtifactId)
    assert.ok(body.verificationId)
    assert.equal(typeof body.salt, 'number')
    assert.equal(typeof body.birthYear, 'number')
    assert.ok(body.commitment)
    assert.ok(body.revocationHash)
  })
})
