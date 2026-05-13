import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { resolveParaProviderStatus } from '../services/paraProvider.js'

export async function providerRoutes(fastify: FastifyInstance) {
  fastify.get('/providers/para/status', { preHandler: requireAuth }, async (_request, reply) => {
    const status = await resolveParaProviderStatus()
    return reply.send(status)
  })
}
