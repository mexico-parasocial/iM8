import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { env } from '../config/env.js'

export async function registerAuth(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    decode: { complete: true },
    sign: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
  })
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const sessionId = (request.user as Record<string, unknown>)?.sub as string | undefined
    if (!sessionId) {
      return reply.status(401).send({ error: request.t('errors.auth.invalidToken') })
    }
    request.sessionId = sessionId
  } catch {
    return reply.status(401).send({ error: request.t('errors.auth.unauthorized') })
  }
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    sessionId?: string
  }
}
