import type { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return reply.send({ status: request.t('health.status'), service: request.t('health.service'), timestamp: new Date().toISOString() })
  })
}
