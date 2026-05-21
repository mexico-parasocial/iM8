import type { HttpContext } from '@adonisjs/core/http'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { z } from 'zod'
import { env } from '../../src/config/env.js'
import { createT, resolveLocale } from '../../src/i18n/index.js'

const jwtSecret = new TextEncoder().encode(env.JWT_SECRET)

export function signAccessToken(sessionId: string) {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ type: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(sessionId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + env.JWT_ACCESS_TTL_SECONDS)
    .sign(jwtSecret)
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: ['HS256'],
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER,
    })
    if (payload.type !== 'access' || !payload.sub) return null
    return payload
  } catch {
    return null
  }
}

export async function requireSessionId(ctx: HttpContext) {
  const authorization = ctx.request.header('authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload?.sub) {
    ctx.response.status(401).send({ error: 'Unauthorized' })
    return null
  }

  return payload.sub
}

export function validateBody<T extends z.ZodTypeAny>(ctx: HttpContext, schema: T): z.infer<T> | null {
  const result = schema.safeParse(ctx.request.body())
  if (result.success) return result.data

  ctx.response.status(422).send({
    error: 'Validation failed',
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  })
  return null
}

export function t(ctx: HttpContext) {
  const locale = resolveLocale(ctx.request.header('accept-language') ?? undefined)
  return createT(locale)
}
