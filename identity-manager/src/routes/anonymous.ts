import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import {
  createAnonymousIdentity,
  getAnonymousPublicContact,
  linkAnonymousPost,
  linkGermContact,
  listAnonymousIdentities,
  unlinkGermContact,
  updateAnonymousIdentity,
  updateAnonymousPostDmPolicy,
  updateAnonymousPostStats,
} from '../services/anonymousIdentityService.js'
import { getDeviceTrustSummary, upsertDevelopmentTrustedDevice } from '../services/deviceTrustService.js'

const surfaceSchema = z.enum(['public', 'civic', 'dating'])

const createIdentitySchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  surface: surfaceSchema.optional(),
  communityUri: z.string().min(1).max(512).nullable().optional(),
}).strict()

const updateIdentitySchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict()

const linkPostSchema = z.object({
  identityId: z.string().min(1).optional(),
  postUri: z.string().min(1).max(512),
  communityUri: z.string().min(1).max(512).nullable().optional(),
  postType: z.string().min(1).max(40).optional(),
  stats: z.object({
    replyCount: z.number().int().min(0).optional(),
    repostCount: z.number().int().min(0).optional(),
    likeCount: z.number().int().min(0).optional(),
    quoteCount: z.number().int().min(0).optional(),
    threadCount: z.number().int().min(0).optional(),
  }).strict().optional(),
}).strict()

const dmPolicySchema = z.object({
  dmPolicy: z.enum(['off', 'requests']),
}).strict()

const postStatsSchema = z.object({
  replyCount: z.number().int().min(0).optional(),
  repostCount: z.number().int().min(0).optional(),
  likeCount: z.number().int().min(0).optional(),
  quoteCount: z.number().int().min(0).optional(),
  threadCount: z.number().int().min(0).optional(),
}).strict()

const germLinkSchema = z.object({
  contactUrl: z.string().url().max(2047),
  providerRef: z.string().max(512).optional(),
  mode: z.enum(['germ-card-link', 'm8-relay-pending-germ']).optional(),
}).strict()

const devTrustSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  deviceKeyId: z.string().min(1).max(256),
  publicKey: z.string().max(4096).optional(),
}).strict()

export async function anonymousRoutes(fastify: FastifyInstance) {
  fastify.get('/anonymous/identities', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ identities: listAnonymousIdentities(request.sessionId!) })
  })

  fastify.post('/anonymous/identities', { preHandler: requireAuth }, async (request, reply) => {
    const body = createIdentitySchema.parse(request.body)
    const identity = createAnonymousIdentity(request.sessionId!, body)
    return reply.status(201).send({ identity })
  })

  fastify.patch('/anonymous/identities/:id', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id: string }
    const body = updateIdentitySchema.parse(request.body)
    const identity = updateAnonymousIdentity(request.sessionId!, params.id, body)
    return reply.send({ identity })
  })

  fastify.post('/anonymous/posts', { preHandler: requireAuth }, async (request, reply) => {
    const body = linkPostSchema.parse(request.body)
    const post = linkAnonymousPost(request.sessionId!, body)
    return reply.status(201).send({ post })
  })

  fastify.patch('/anonymous/posts/:id/dm-policy', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id: string }
    const body = dmPolicySchema.parse(request.body)
    const post = updateAnonymousPostDmPolicy(request.sessionId!, params.id, body.dmPolicy)
    return reply.send({ post })
  })

  fastify.patch('/anonymous/posts/:id/stats', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id: string }
    const body = postStatsSchema.parse(request.body)
    const post = updateAnonymousPostStats(request.sessionId!, params.id, body)
    return reply.send({ post })
  })

  fastify.post('/anonymous/identities/:id/germ/link', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id: string }
    const body = germLinkSchema.parse(request.body)
    const germ = linkGermContact(request.sessionId!, params.id, body)
    return reply.send({ germ })
  })

  fastify.post('/anonymous/identities/:id/germ/unlink', { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id: string }
    const germ = unlinkGermContact(request.sessionId!, params.id)
    return reply.send({ germ })
  })

  fastify.get('/anonymous/public-contact', async (request, reply) => {
    const query = request.query as { postUri?: string }
    if (!query.postUri) return reply.status(400).send({ error: 'postUri is required' })
    return reply.send(getAnonymousPublicContact(query.postUri))
  })

  fastify.get('/device-trust/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ deviceTrust: getDeviceTrustSummary(request.sessionId!) })
  })

  fastify.post('/device-trust/development/verify', { preHandler: requireAuth }, async (request, reply) => {
    const body = devTrustSchema.parse(request.body)
    const deviceTrust = upsertDevelopmentTrustedDevice(request.sessionId!, body)
    return reply.send({ deviceTrust })
  })
}
