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

describe('sessions integration', () => {
  let app: FastifyInstance

  before(async () => {
    ;({ buildApp } = await import('../../src/index.js'))
    ;({ closeDb } = await import('../../src/db/connection.js'))
    app = await buildApp()
  })

  after(async () => {
    await app.close()
    closeDb()
  })

  it('POST /v1/sessions/start creates a session and returns tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions/start',
      payload: { identifier: 'testuser.bsky.social' },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.ok(body.attempt.sessionId)
    assert.ok(body.session)
    assert.ok(body.tokens.accessToken)
    assert.ok(body.tokens.refreshToken)
    assert.equal(body.tokens.expiresIn, 86400)
  })

  it('GET /v1/sessions/me requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/sessions/me',
    })
    assert.equal(res.statusCode, 401)
  })

  it('GET /v1/sessions/me returns session when authenticated', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/v1/sessions/start',
      payload: { identifier: 'authed.bsky.social' },
    })
    const { tokens } = JSON.parse(start.payload)

    const res = await app.inject({
      method: 'GET',
      url: '/v1/sessions/me',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.session.handle, 'authed.bsky.social')
  })
})
