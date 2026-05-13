import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { requestGrant, approveGrant, revokeGrant } from '../services/grantService.js'
import { hydrateSession } from '../services/sessionService.js'


const claimSpecSchema = z.object({
  type: z.enum(['is_verified_public_figure', 'is_civic_eligible', 'has_para_verification', 'has_party_affiliation_match', 'is_age_eligible', 'has_backup_coverage']),
  disclosure: z.enum(['proof-only', 'signed-claim', 'raw']),
  requestedValue: z.string().optional(),
})

const requestGrantSchema = z.object({
  appId: z.string().min(1).max(128),
  appName: z.string().min(1).max(256),
  appKind: z.enum(['Consumer app', 'Civic app', 'Community app', 'Local app', 'Verifier', 'Broker']),
  surface: z.enum(['public', 'civic', 'dating']),
  requestedClaims: z.array(claimSpecSchema).min(1).max(20),
  proofMode: z.enum(['proof-only', 'signed-claim', 'raw']),
  reason: z.string().min(1).max(1024),
  expiresAt: z.string().datetime().optional().nullable(),
})

const approveGrantSchema = z.object({
  grantId: z.string().min(1),
  reviewNote: z.string().max(2048).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
})

const revokeGrantSchema = z.object({
  grantId: z.string().min(1),
  reason: z.string().max(2048).optional(),
})

export async function grantRoutes(fastify: FastifyInstance) {
  fastify.post('/grants', { preHandler: requireAuth }, async (request, reply) => {
    const body = requestGrantSchema.parse(request.body)
    const result = requestGrant(request.sessionId!, body)
    return reply.status(201).send(result)
  })

  fastify.post('/grants/:id/approve', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as Record<string, string>
    const body = approveGrantSchema.parse(request.body)
    const result = approveGrant(request.sessionId!, { ...body, grantId: params.id })
    return reply.send(result)
  })

  fastify.post('/grants/:id/revoke', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as Record<string, string>
    const body = revokeGrantSchema.parse(request.body)
    const result = revokeGrant(request.sessionId!, { ...body, grantId: params.id })
    return reply.send(result)
  })

  fastify.get('/grants', { preHandler: requireAuth }, async (request, reply) => {
    const session = hydrateSession(request.sessionId!)
    return reply.send({ grants: session.grants, proofs: session.proofs })
  })
}
