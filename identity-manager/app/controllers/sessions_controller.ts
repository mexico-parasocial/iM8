import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { HttpContext } from '@adonisjs/core/http'
import { getDb } from '../../src/db/connection.js'
import { env } from '../../src/config/env.js'
import { completeOAuthCallback, initiateOAuthLogin } from '../../src/services/atprotoAuth.js'
import { createSession, hashRefreshToken, hydrateSession } from '../../src/services/sessionService.js'
import {
  createAnonymousProfile,
  deleteAnonymousProfile,
  getAnonymousProfile,
} from '../../src/services/anonymousProfileService.js'
import { requireSessionId, signAccessToken, t, validateBody } from '#support/http'

const startSessionSchema = z.object({
  identifier: z.string().min(1).max(256),
})

export default class SessionsController {
  async start(ctx: HttpContext) {
    const body = validateBody(ctx, startSessionSchema)
    if (!body) return

    const result = await createSession(body)
    const accessToken = await signAccessToken(result.attempt.sessionId)
    const refreshToken = randomUUID()
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86400_000).toISOString()

    getDb()
      .prepare('INSERT INTO refresh_tokens (token_hash, session_id, expires_at) VALUES (?, ?, ?)')
      .run(hashRefreshToken(refreshToken), result.attempt.sessionId, expiresAt)

    let oauthUrl: string | null = null
    try {
      const oauth = await initiateOAuthLogin(body.identifier)
      oauthUrl = oauth.url
    } catch {
      oauthUrl = null
    }

    return ctx.response.send({
      ...result,
      tokens: { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL_SECONDS },
      oauthUrl,
    })
  }

  async oauthCallback(ctx: HttpContext) {
    try {
      const params = new URLSearchParams(ctx.request.request.url?.split('?')[1] ?? '')
      const result = await completeOAuthCallback(params)
      const sessionRow = getDb()
        .prepare('SELECT session_id FROM sessions WHERE did = ?')
        .get(result.did) as { session_id: string } | undefined

      if (sessionRow) {
        getDb()
          .prepare('UPDATE sessions SET authenticated_at = ? WHERE session_id = ?')
          .run(new Date().toISOString(), sessionRow.session_id)
      }

      return ctx.response.send({
        did: result.did,
        authenticated: true,
        sessionId: sessionRow?.session_id ?? null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth callback failed'
      return ctx.response.status(400).send({ error: message, code: 'OAUTH_CALLBACK_FAILED' })
    }
  }

  async me(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    return ctx.response.send({
      session: hydrateSession(sessionId),
      anonymousProfile: getAnonymousProfile(sessionId),
    })
  }

  async enableAnonymous(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const existing = getAnonymousProfile(sessionId)
    const $t = t(ctx)
    if (existing) {
      return ctx.response.status(400).send({ error: $t('errors.anonymous.alreadyEnabled') })
    }

    return ctx.response.send({ anonymousProfile: createAnonymousProfile(sessionId, $t('anonymous.prefix')) })
  }

  async disableAnonymous(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    deleteAnonymousProfile(sessionId)
    return ctx.response.send({ disabled: true })
  }

  async refresh(ctx: HttpContext) {
    const refreshToken = (ctx.request.body() as { refreshToken?: string } | null)?.refreshToken
    if (!refreshToken) {
      return ctx.response.status(400).send({ error: 'refreshToken is required' })
    }

    const row = getDb()
      .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL')
      .get(hashRefreshToken(refreshToken)) as Record<string, unknown> | undefined

    if (!row || new Date(row.expires_at as string).getTime() <= Date.now()) {
      return ctx.response.status(401).send({ error: 'Invalid refresh token' })
    }

    return ctx.response.send({
      accessToken: await signAccessToken(row.session_id as string),
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    })
  }
}
