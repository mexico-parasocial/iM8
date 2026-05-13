import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { getDb } from '../db/connection.js'
import { getAnonymousProfile } from '../services/anonymousProfileService.js'

export async function karmaRoutes(fastify: FastifyInstance) {
  fastify.post('/karma/earn', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      actionType: string
      communityId?: string
      points?: number
      detail?: Record<string, unknown>
    }
    const db = getDb()
    const anon = getAnonymousProfile(request.sessionId!)
    if (!anon) {
      return reply.status(400).send({ error: request.t('errors.karma.profileRequired') })
    }

    const id = `karma-${randomUUID()}`
    db.prepare(`
      INSERT INTO karma (id, anonymous_profile_id, community_id, action_type, points, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      anon.id,
      body.communityId ?? null,
      body.actionType,
      body.points ?? 1,
      JSON.stringify(body.detail ?? {}),
      new Date().toISOString(),
    )

    return reply.send({ earned: true, id, points: body.points ?? 1 })
  })

  fastify.get('/karma/me', { preHandler: requireAuth }, async (request, reply) => {
    const db = getDb()
    const anon = getAnonymousProfile(request.sessionId!)
    if (!anon) {
      return reply.send({ global: 0, byCommunity: [], actions: [] })
    }

    const rows = db.prepare(`
      SELECT community_id, action_type, SUM(points) as total
      FROM karma
      WHERE anonymous_profile_id = ?
      GROUP BY community_id, action_type
    `).all(anon.id) as Array<{ community_id: string | null; action_type: string; total: number }>

    const byCommunity: Record<string, number> = {}
    let global = 0
    const actions: Record<string, number> = {}

    for (const row of rows) {
      global += row.total
      if (row.community_id) {
        byCommunity[row.community_id] = (byCommunity[row.community_id] ?? 0) + row.total
      }
      actions[row.action_type] = (actions[row.action_type] ?? 0) + row.total
    }

    return reply.send({ global, byCommunity, actions, profileId: anon.id })
  })

  fastify.get('/karma/:profileId', async (request, reply) => {
    const { profileId } = request.params as { profileId: string }
    const db = getDb()

    const revelation = db.prepare('SELECT reveal_global, reveal_communities_json FROM karma_revelation WHERE anonymous_profile_id = ?')
      .get(profileId) as { reveal_global: number; reveal_communities_json: string } | undefined

    const rows = db.prepare(`
      SELECT community_id, action_type, SUM(points) as total
      FROM karma
      WHERE anonymous_profile_id = ?
      GROUP BY community_id, action_type
    `).all(profileId) as Array<{ community_id: string | null; action_type: string; total: number }>

    const revealGlobal = revelation?.reveal_global === 1
    const revealCommunities = new Set<string>(JSON.parse(revelation?.reveal_communities_json ?? '[]') as string[])

    let global = 0
    const byCommunity: Record<string, number> = {}
    const actions: Record<string, number> = {}

    for (const row of rows) {
      global += row.total
      if (row.community_id) {
        byCommunity[row.community_id] = (byCommunity[row.community_id] ?? 0) + row.total
      }
      actions[row.action_type] = (actions[row.action_type] ?? 0) + row.total
    }

    return reply.send({
      profileId,
      global: revealGlobal ? global : null,
      byCommunity: Object.fromEntries(
        Object.entries(byCommunity).filter(([cid]) => revealCommunities.has(cid))
      ),
      actions: revealGlobal ? actions : {},
      revealed: { global: revealGlobal, communities: Array.from(revealCommunities) },
    })
  })

  fastify.put('/karma/revelation', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      revealGlobal?: boolean
      revealCommunities?: string[]
    }
    const db = getDb()
    const anon = getAnonymousProfile(request.sessionId!)
    if (!anon) {
      return reply.status(400).send({ error: request.t('errors.karma.profileRequired') })
    }

    const existing = db.prepare('SELECT 1 FROM karma_revelation WHERE anonymous_profile_id = ?').get(anon.id)
    if (existing) {
      db.prepare(`
        UPDATE karma_revelation
        SET reveal_global = ?, reveal_communities_json = ?, updated_at = ?
        WHERE anonymous_profile_id = ?
      `).run(
        body.revealGlobal ? 1 : 0,
        JSON.stringify(body.revealCommunities ?? []),
        new Date().toISOString(),
        anon.id,
      )
    } else {
      db.prepare(`
        INSERT INTO karma_revelation (anonymous_profile_id, reveal_global, reveal_communities_json, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(
        anon.id,
        body.revealGlobal ? 1 : 0,
        JSON.stringify(body.revealCommunities ?? []),
        new Date().toISOString(),
      )
    }

    return reply.send({ updated: true })
  })
}
