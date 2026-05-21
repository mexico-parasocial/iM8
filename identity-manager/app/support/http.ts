import { createHmac, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { z } from 'zod'
import { env } from '../../src/config/env.js'
import { createT, resolveLocale } from '../../src/i18n/index.js'

type JwtPayload = {
  sub?: string
  type?: string
  exp?: number
  iat?: number
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string) {
  return createHmac('sha256', env.JWT_SECRET).update(data).digest('base64url')
}

export function signAccessToken(sessionId: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      sub: sessionId,
      type: 'access',
      iat: now,
      exp: now + env.JWT_ACCESS_TTL_SECONDS,
    })
  )
  const unsigned = `${header}.${payload}`
  return `${unsigned}.${sign(unsigned)}`
}

function verifyAccessToken(token: string): JwtPayload | null {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null

  const expected = sign(`${header}.${payload}`)
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(signature)
  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload
    if (parsed.type !== 'access' || !parsed.sub) return null
    if (parsed.exp && parsed.exp <= Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}

export function requireSessionId(ctx: HttpContext) {
  const authorization = ctx.request.header('authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]
  const payload = token ? verifyAccessToken(token) : null

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
