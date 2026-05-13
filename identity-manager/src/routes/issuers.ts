import type { FastifyInstance } from 'fastify'
import { TRUSTED_ISSUERS } from '../services/identityWallet.js'

export async function issuerRoutes(fastify: FastifyInstance) {
  fastify.get('/issuers', async (_request, reply) => {
    return reply.send(TRUSTED_ISSUERS)
  })
}
