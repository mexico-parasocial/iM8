import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { verifyClaim } from '../services/trustPolicy.js'
import { getDb } from '../db/connection.js'

const verifyClaimSchema = z.object({
  claimType: z.enum(['is_verified_public_figure', 'is_civic_eligible', 'has_para_verification', 'has_party_affiliation_match', 'is_age_eligible', 'has_backup_coverage']),
  requestedValue: z.string().optional(),
  audienceAppId: z.string().min(1),
  audienceAppName: z.string().min(1),
  surface: z.enum(['public', 'civic', 'dating']),
  proofMode: z.enum(['proof-only', 'signed-claim', 'raw']),
  verifierId: z.enum(['para.identity', 'm8.broker']),
  reason: z.string().min(1),
})

export async function claimRoutes(fastify: FastifyInstance) {
  fastify.post('/claims/:id/verify', { preHandler: requireAuth }, async (request, reply) => {
    const body = verifyClaimSchema.parse(request.body)
    const result = verifyClaim({ sessionId: request.sessionId!, ...body })

    // Upsert a proof artifact for this verification
    const db = getDb()
    const now = new Date().toISOString()
    const proofId = `proof-${randomUUID()}`

    db.prepare(`
      INSERT INTO proof_artifacts (id, session_id, grant_id, request_id, claim_type, requested_value, outcome, statement, proof_mode, issuer_id, verifier_id, audience_app_id, audience_app_name, surface, reference, status, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      proofId,
      request.sessionId!,
      'direct-verify',
      (request.params as Record<string, string>).id,
      body.claimType,
      body.requestedValue ?? null,
      result.outcome,
      result.statement,
      body.proofMode,
      body.verifierId,
      body.verifierId,
      body.audienceAppId,
      body.audienceAppName,
      body.surface,
      result.reference ?? '',
      'active',
      now
    )

    return reply.send({ proofId, ...result })
  })
}
