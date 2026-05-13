import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const tmpDir = mkdtempSync(join(tmpdir(), 'm8-test-'))
process.env.DATABASE_PATH = join(tmpDir, 'test.db')

let buildApp: typeof import('../../src/index.js').buildApp
let closeDb: typeof import('../../src/db/connection.js').closeDb

describe('grants integration', () => {
  let app: FastifyInstance
  let accessToken: string

  before(async () => {
    ;({ buildApp } = await import('../../src/index.js'))
    ;({ closeDb } = await import('../../src/db/connection.js'))
    app = await buildApp()
    const start = await app.inject({
      method: 'POST',
      url: '/v1/sessions/start',
      payload: { identifier: 'grantuser.bsky.social' },
    })
    const body = JSON.parse(start.payload)
    accessToken = body.tokens.accessToken
  })

  after(async () => {
    await app.close()
    closeDb()
  })

  it('POST /v1/grants creates a grant request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/grants',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        appId: 'test.app',
        appName: 'Test App',
        appKind: 'Consumer app',
        surface: 'public',
        requestedClaims: [{ type: 'has_para_verification', disclosure: 'proof-only' }],
        proofMode: 'proof-only',
        reason: 'Testing grant request',
      },
    })

    assert.equal(res.statusCode, 201)
    const body = JSON.parse(res.payload)
    assert.equal(body.grant.status, 'pending')
    assert.equal(body.grant.appId, 'test.app')
  })

  it('POST /v1/grants/:id/approve approves a grant', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/v1/grants',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        appId: 'test.app',
        appName: 'Test App',
        appKind: 'Consumer app',
        surface: 'public',
        requestedClaims: [{ type: 'has_para_verification', disclosure: 'proof-only' }],
        proofMode: 'proof-only',
        reason: 'Testing approval',
      },
    })
    const { grant } = JSON.parse(create.payload)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/grants/${grant.id}/approve`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { grantId: grant.id, reviewNote: 'Looks good' },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.grant.status, 'approved')
    assert.ok(body.proofs.length > 0)
  })

  it('POST /v1/grants/:id/revoke revokes a grant', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/v1/grants',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        appId: 'revoke.app',
        appName: 'Revoke App',
        appKind: 'Consumer app',
        surface: 'public',
        requestedClaims: [{ type: 'has_para_verification', disclosure: 'proof-only' }],
        proofMode: 'proof-only',
        reason: 'Testing revoke',
      },
    })
    const { grant } = JSON.parse(create.payload)

    const res = await app.inject({
      method: 'POST',
      url: `/v1/grants/${grant.id}/revoke`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { grantId: grant.id, reason: 'User requested' },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.grant.status, 'revoked')
  })
})
