import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'
import { recordAbuse } from '../../src/services/abuseMonitor.js'

/**
 * In-memory rate limiter. Effective for single-process deployments.
 *
 * ⚠️ Known limitation: this Map is process-local. It will NOT share
 * state across PM2 clusters, multiple containers, or horizontal replicas.
 * An attacker distributing requests across workers/instances can bypass
 * the limit. For multi-instance deployments, replace with a Redis-backed
 * limiter (e.g., `@adonisjs/limiter` with Redis driver) or place rate
 * limiting at the edge (load balancer / API gateway).
 */

type RateLimitEntry = {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetTime <= now) {
      store.delete(key)
    }
  }
}

// Run cleanup every 60 seconds
setInterval(cleanupExpiredEntries, 60_000).unref()

function getClientIp(ctx: HttpContext): string {
  return (
    ctx.request.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    ctx.request.header('x-real-ip') ??
    ctx.request.ip()
  )
}

function getRateLimitKey(ctx: HttpContext): string {
  const ip = getClientIp(ctx)
  const method = ctx.request.method()
  const path = ctx.request.url()
  return `${ip}:${method}:${path}`
}

function isAuthEndpoint(path: string): boolean {
  return (
    path.includes('/sessions/') ||
    path.includes('/identity/ine/') ||
    path.includes('/identity/revoke')
  )
}

export default class RateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!env.get('RATE_LIMIT_ENABLED')) {
      return next()
    }

    const windowMs = env.get('RATE_LIMIT_WINDOW_MS')
    const maxRequests = env.get('RATE_LIMIT_MAX')
    const authMaxRequests = env.get('RATE_LIMIT_AUTH_MAX')
    const key = getRateLimitKey(ctx)
    const now = Date.now()

    let entry = store.get(key)
    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime: now + windowMs }
      store.set(key, entry)
    }

    const limit = isAuthEndpoint(ctx.request.url()) ? authMaxRequests : maxRequests

    if (entry.count >= limit) {
      recordAbuse({
        type: 'rate_limit_exceeded',
        ip: getClientIp(ctx),
        path: ctx.request.url(true),
        method: ctx.request.method(),
        userAgent: ctx.request.header('user-agent') ?? 'unknown',
        requestId: ctx.request.id() ?? 'unknown',
        sessionId: null,
        detail: `limit=${limit} window=${windowMs}ms`,
      })

      return ctx.response.status(429).send({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      })
    }

    entry.count++
    ctx.response.header('X-RateLimit-Limit', String(limit))
    ctx.response.header('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)))
    ctx.response.header('X-RateLimit-Reset', new Date(entry.resetTime).toISOString())

    return next()
  }
}
