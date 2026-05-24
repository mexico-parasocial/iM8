import { z } from 'zod'
import type { HttpContext } from '@adonisjs/core/http'
import { getDb } from '../../src/db/connection.js'
import { Features, assertDemoPathAllowed } from '../../src/services/features.js'
import { completeOAuthCallback, initiateOAuthLogin } from '../../src/services/atprotoAuth.js'
import {
  completeOAuthLoginAttempt,
  createOAuthLoginAttempt,
  failOAuthLoginAttempt,
  getPendingOAuthLoginAttempt,
} from '../../src/services/oauthLoginAttempts.js'
import { createSession, hydrateSession } from '../../src/services/sessionService.js'
import { issueTokenBundle, rotateRefreshToken, TokenIssueError } from '../../src/services/tokenService.js'
import {
  createAnonymousProfile,
  deleteAnonymousProfile,
  getAnonymousProfile,
} from '../../src/services/anonymousProfileService.js'
import { getSessionId, t, validateBody } from '#support/http'

const startSessionSchema = z.object({
  identifier: z.string().min(1).max(256),
})

export default class SessionsController {
  async start(ctx: HttpContext) {
    const body = validateBody(ctx, startSessionSchema)
    if (!body) return

    const devTokenBootstrap = assertDemoPathAllowed(Features.AuthDevTokenBootstrap)

    let oauth: { url: string; state: string } | null = null
    try {
      oauth = await initiateOAuthLogin(body.identifier)
    } catch {
      oauth = null
    }

    if (!devTokenBootstrap && !oauth) {
      return ctx.response.status(503).send({
        error: 'OAuth authorization is unavailable',
        code: 'OAUTH_UNAVAILABLE',
      })
    }

    if (!devTokenBootstrap) {
      const oauthLogin = oauth
      if (!oauthLogin) {
        return ctx.response.status(503).send({
          error: 'OAuth authorization is unavailable',
          code: 'OAUTH_UNAVAILABLE',
        })
      }
      const attempt = createOAuthLoginAttempt({
        identifier: body.identifier,
        state: oauthLogin.state,
        oauthUrl: oauthLogin.url,
      })

      return ctx.response.status(202).send({
        attempt: {
          attemptId: attempt.id,
          identifier: attempt.identifier,
          authUrl: attempt.oauthUrl,
          phaseLabel: 'Awaiting OAuth callback',
          startedAt: attempt.createdAt,
          expiresAt: attempt.expiresAt,
        },
        tokens: null,
        session: null,
        oauthUrl: attempt.oauthUrl,
      })
    }

    const result = await createSession(body)
    result.attempt.authUrl = oauth?.url ?? result.attempt.authUrl

    return ctx.response.send({
      ...result,
      tokens: await issueTokenBundle(result.attempt.sessionId!, {
        source: 'dev_token_bootstrap',
      }),
      oauthUrl: oauth?.url ?? null,
    })
  }

  async oauthCallback(ctx: HttpContext) {
    let attemptId: string | null = null
    try {
      const params = new URLSearchParams(ctx.request.request.url?.split('?')[1] ?? '')
      const state = params.get('state')
      if (!state) {
        return ctx.response.status(400).send({ error: 'OAuth state is required', code: 'OAUTH_STATE_REQUIRED' })
      }

      const attempt = getPendingOAuthLoginAttempt(state)
      if (!attempt) {
        return ctx.response.status(400).send({ error: 'OAuth login attempt not found or expired', code: 'OAUTH_ATTEMPT_INVALID' })
      }
      attemptId = attempt.id

      const result = await completeOAuthCallback(params)
      let sessionRow = getDb()
        .prepare("SELECT session_id FROM sessions WHERE did = ? AND status = 'active'")
        .get(result.did) as { session_id: string } | undefined

      if (!sessionRow) {
        const created = await createSession({ identifier: result.did })
        if (!created.attempt.sessionId) {
          throw new Error('OAuth callback could not create an authenticated session')
        }
        sessionRow = { session_id: created.attempt.sessionId }
      }

      getDb()
        .prepare('UPDATE sessions SET authenticated_at = ? WHERE session_id = ?')
        .run(new Date().toISOString(), sessionRow.session_id)
      completeOAuthLoginAttempt({
        id: attempt.id,
        resolvedDid: result.did,
        sessionId: sessionRow.session_id,
      })

      return ctx.response.send({
        did: result.did,
        authenticated: true,
        sessionId: sessionRow.session_id,
        session: hydrateSession(sessionRow.session_id),
        tokens: await issueTokenBundle(sessionRow.session_id, {
          source: 'oauth_callback',
          oauthAttemptId: attempt.id,
        }),
      })
    } catch (error) {
      if (attemptId) {
        failOAuthLoginAttempt(attemptId, 'OAUTH_CALLBACK_FAILED')
      }
      const message = error instanceof Error ? error.message : 'OAuth callback failed'
      return ctx.response.status(400).send({ error: message, code: 'OAUTH_CALLBACK_FAILED' })
    }
  }

  async me(ctx: HttpContext) {
    const sessionId = getSessionId(ctx)

    return ctx.response.send({
      session: hydrateSession(sessionId),
      anonymousProfile: getAnonymousProfile(sessionId),
    })
  }

  async enableAnonymous(ctx: HttpContext) {
    const sessionId = getSessionId(ctx)

    const existing = getAnonymousProfile(sessionId)
    const $t = t(ctx)
    if (existing) {
      return ctx.response.status(400).send({ error: $t('errors.anonymous.alreadyEnabled') })
    }

    return ctx.response.send({ anonymousProfile: createAnonymousProfile(sessionId, $t('anonymous.prefix')) })
  }

  async disableAnonymous(ctx: HttpContext) {
    const sessionId = getSessionId(ctx)

    deleteAnonymousProfile(sessionId)
    return ctx.response.send({ disabled: true })
  }

  async refresh(ctx: HttpContext) {
    const refreshToken = (ctx.request.body() as { refreshToken?: string } | null)?.refreshToken
    if (!refreshToken) {
      return ctx.response.status(400).send({ error: 'refreshToken is required' })
    }

    try {
      return ctx.response.send(await rotateRefreshToken(refreshToken))
    } catch (error) {
      const code = error instanceof TokenIssueError ? error.code : 'INVALID_REFRESH_TOKEN'
      return ctx.response.status(401).send({ error: 'Invalid refresh token', code })
    }
  }
}
