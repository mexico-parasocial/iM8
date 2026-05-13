import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const tmpDir = mkdtempSync(join(tmpdir(), 'm8-anon-test-'))
process.env.DATABASE_PATH = join(tmpDir, 'anon-test.db')

describe('Anonymous mode integration', () => {
  let app: FastifyInstance
  let accessToken: string

  before(async () => {
    const { buildApp } = await import('../../src/index.js')
    app = await buildApp()
    const start = await app.inject({
      method: 'POST',
      url: '/v1/sessions/start',
      payload: { identifier: 'anonuser.bsky.social' },
    })
    const body = JSON.parse(start.payload)
    accessToken = body.tokens.accessToken
  })

  after(async () => {
    await app.close()
  })

  it('GET /v1/sessions/me returns anonymousProfile: null when not enabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/sessions/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.anonymousProfile, null)
  })

  it('POST /v1/sessions/anonymous/enable creates anonymous profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions/anonymous/enable',
      headers: { authorization: `Bearer ${accessToken}`, 'accept-language': 'en' },
    })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.ok(body.anonymousProfile)
    assert.ok(body.anonymousProfile.id)
    assert.ok(body.anonymousProfile.displayName.startsWith('Citizen #'))
    assert.ok(body.anonymousProfile.avatarSeed)
    assert.ok(body.anonymousProfile.createdAt)
  })

  it('GET /v1/sessions/me returns anonymousProfile after enable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/sessions/me',
      headers: { authorization: `Bearer ${accessToken}`, 'accept-language': 'en' },
    })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.ok(body.anonymousProfile)
    assert.ok(body.anonymousProfile.displayName.startsWith('Citizen #'))
    assert.ok(body.anonymousProfile.avatarSeed)
    assert.ok(body.anonymousProfile.createdAt)
  })

  it('POST /v1/sessions/anonymous/enable fails when already enabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions/anonymous/enable',
      headers: { authorization: `Bearer ${accessToken}`, 'accept-language': 'en' },
    })
    assert.equal(res.statusCode, 400)
    const body = JSON.parse(res.payload)
    assert.equal(body.error, 'Anonymous mode already enabled')
  })

  it('POST /v1/sessions/anonymous/disable removes anonymous profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions/anonymous/disable',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.disabled, true)

    const me = await app.inject({
      method: 'GET',
      url: '/v1/sessions/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    const meBody = JSON.parse(me.payload)
    assert.equal(meBody.anonymousProfile, null)
  })
})
