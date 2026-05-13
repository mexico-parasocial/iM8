import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { createSession, hydrateSession } from '../services/sessionService.js'
import { initiateOAuthLogin, completeOAuthCallback } from '../services/atprotoAuth.js'
import { env } from '../config/env.js'
import {
  createAnonymousProfile,
  deleteAnonymousProfile,
  getAnonymousProfile,
} from '../services/anonymousProfileService.js'

const startSessionSchema = z.object({
  identifier: z.string().min(1).max(256),
})

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions/start', {
    schema: {
      body: startSessionSchema,
    },
    validatorCompiler: () => (data) => {
      const result = startSessionSchema.safeParse(data)
      return result.success ? { value: result.data } : { error: result.error }
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof startSessionSchema>

    // Create local session with real DID resolution
    const result = await createSession(body)

    // Issue JWT access + refresh tokens
    const accessToken = fastify.jwt.sign({ sub: result.attempt.sessionId, type: 'access' })
    const refreshToken = randomUUID()

    const { hashRefreshToken } = await import('../services/sessionService.js')
    const db = (await import('../db/connection.js')).getDb()
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86400_000).toISOString()
    db.prepare('INSERT INTO refresh_tokens (token_hash, session_id, expires_at) VALUES (?, ?, ?)').run(
      hashRefreshToken(refreshToken),
      result.attempt.sessionId,
      expiresAt
    )

    // Optionally initiate ATProto OAuth for full federation
    let oauthUrl: string | null = null
    try {
      const oauth = await initiateOAuthLogin(body.identifier)
      oauthUrl = oauth.url
    } catch {
      // OAuth init failed — still return local session
      oauthUrl = null
    }

    return reply.send({
      ...result,
      tokens: { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS },
      oauthUrl,
    })
  })

  fastify.get('/sessions/oauth/callback', async (request, reply) => {
    try {
      const params = new URLSearchParams(request.url.split('?')[1] ?? '')
      const result = await completeOAuthCallback(params)

      // Update session with OAuth-verified DID
      const db = (await import('../db/connection.js')).getDb()
      const sessionRow = db.prepare('SELECT session_id FROM sessions WHERE did = ?').get(result.did) as { session_id: string } | undefined

      if (sessionRow) {
        db.prepare('UPDATE sessions SET authenticated_at = ? WHERE session_id = ?').run(
          new Date().toISOString(),
          sessionRow.session_id
        )
      }

      return reply.send({
        did: result.did,
        authenticated: true,
        sessionId: sessionRow?.session_id ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : request.t('errors.session.oauthFailed')
      return reply.status(400).send({ error: message, code: 'OAUTH_CALLBACK_FAILED' })
    }
  })

  fastify.get('/sessions/me', { preHandler: requireAuth }, async (request, reply) => {
    const session = hydrateSession(request.sessionId!)
    const anonProfile = getAnonymousProfile(request.sessionId!)

    return reply.send({
      session,
      anonymousProfile: anonProfile,
    })
  })

  // ─── Anonymous Mode ────────────────────────────────────────────────────────

  fastify.post('/sessions/anonymous/enable', { preHandler: requireAuth }, async (request, reply) => {
    const existing = getAnonymousProfile(request.sessionId!)
    if (existing) {
      return reply.status(400).send({ error: request.t('errors.anonymous.alreadyEnabled') })
    }

    const profile = createAnonymousProfile(request.sessionId!, request.t('anonymous.prefix'))
    return reply.send({ anonymousProfile: profile })
  })

  fastify.post('/sessions/anonymous/disable', { preHandler: requireAuth }, async (request, reply) => {
    deleteAnonymousProfile(request.sessionId!)
    return reply.send({ disabled: true })
  })

  fastify.post('/sessions/refresh', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const refreshToken = body?.refreshToken as string | undefined
    if (!refreshToken) {
      return reply.status(400).send({ error: request.t('errors.session.refreshRequired') })
    }

    const { hashRefreshToken } = await import('../services/sessionService.js')
    const db = (await import('../db/connection.js')).getDb()
    const hash = hashRefreshToken(refreshToken)
    const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL').get(hash) as Record<string, unknown> | undefined

    if (!row || new Date(row.expires_at as string).getTime() <= Date.now()) {
      return reply.status(401).send({ error: request.t('errors.session.invalidRefresh') })
    }

    const sessionId = row.session_id as string
    const accessToken = fastify.jwt.sign({ sub: sessionId, type: 'access' })
    return reply.send({ accessToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS })
  })
}
