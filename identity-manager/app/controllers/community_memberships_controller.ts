import type { HttpContext } from '@adonisjs/core/http'
import { getSessionId } from '#support/http'
import { getDb } from '../../src/db/connection.js'
import { getCommunity } from '../../src/services/communityService.js'
import { isAdmin } from '../../src/services/communityAdminService.js'
import { addCommunityMemberRecord } from '../../src/services/communityAgentService.js'
import { xrpcRequest } from '../../src/services/atprotoAgent.js'

function appError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

function nowIso() {
  return new Date().toISOString()
}

async function getSessionDid(ctx: HttpContext): Promise<string> {
  const sessionId = getSessionId(ctx)
  const db = getDb()
  const row = db.prepare('SELECT did FROM sessions WHERE session_id = ?').get(sessionId) as
    | Record<string, unknown>
    | undefined
  if (!row) {
    throw appError('Session not found', 404, 'SESSION_NOT_FOUND')
  }
  return row.did as string
}

export default class CommunityMembershipsController {
  async index(ctx: HttpContext) {
    const communityId = ctx.params.id as string
    const status = ctx.request.qs().status as string | undefined
    const limit = Math.min(parseInt(ctx.request.qs().limit as string) || 50, 100)
    const offset = parseInt(ctx.request.qs().offset as string) || 0

    const community = getCommunity(communityId)
    if (!community) {
      throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
    }

    const db = getDb()
    let whereClause = 'WHERE community_id = ?'
    const params: (string | number)[] = [communityId]

    if (status) {
      whereClause += ' AND status = ?'
      params.push(status)
    }
    params.push(limit, offset)

    const rows = db
      .prepare(`SELECT * FROM community_memberships ${whereClause} ORDER BY joined_at DESC LIMIT ? OFFSET ?`)
      .all(...params) as Record<string, unknown>[]

    const countParams: (string | number)[] = [communityId]
    if (status) countParams.push(status)
    const countRow = db
      .prepare(`SELECT COUNT(*) as count FROM community_memberships ${whereClause}`)
      .get(...countParams) as Record<string, unknown>

    const memberships = rows.map((row) => ({
      communityId: row.community_id as string,
      memberDid: row.member_did as string,
      status: row.status as string,
      joinedAt: (row.joined_at as string) ?? null,
      leftAt: (row.left_at as string) ?? null,
    }))

    return ctx.response.send({
      memberships,
      pagination: { total: (countRow.count as number) ?? 0, limit, offset },
    })
  }

  async store(ctx: HttpContext) {
    const communityId = ctx.params.id as string
    const memberDid = await getSessionDid(ctx)
    const now = nowIso()

    const community = getCommunity(communityId)
    if (!community) {
      throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
    }

    const db = getDb()

    // Check if membership already exists
    const existing = db
      .prepare('SELECT status FROM community_memberships WHERE community_id = ? AND member_did = ?')
      .get(communityId, memberDid) as Record<string, unknown> | undefined

    if (existing?.status === 'active' || existing?.status === 'pending') {
      throw appError('Membership request already exists', 409, 'MEMBERSHIP_EXISTS')
    }

    if (existing?.status === 'left') {
      // Re-apply
      db.prepare(
        'UPDATE community_memberships SET status = ?, joined_at = ?, left_at = NULL WHERE community_id = ? AND member_did = ?'
      ).run('pending', now, communityId, memberDid)
    } else {
      db.prepare(
        'INSERT INTO community_memberships (community_id, member_did, status, joined_at) VALUES (?, ?, ?, ?)'
      ).run(communityId, memberDid, 'pending', now)
    }

    // Write membership request to member's repo (first half of two-way handshake)
    let memberRecordUri: string | null = null
    try {
      const memberRecord = await xrpcRequest(memberDid, 'com.atproto.repo.createRecord', {
        method: 'POST',
        body: JSON.stringify({
          repo: memberDid,
          collection: 'app.m8.community.membership',
          record: {
            $type: 'app.m8.community.membership',
            communityDid: community.did,
            status: 'pending',
            joinedAt: now,
          },
        }),
      }) as { uri: string; cid: string }
      memberRecordUri = memberRecord.uri

      db.prepare(
        'UPDATE community_memberships SET membership_record_uri = ? WHERE community_id = ? AND member_did = ?'
      ).run(memberRecordUri, communityId, memberDid)
    } catch {
      // Best-effort: member's PDS might not be accessible
    }

    return ctx.response.status(201).send({
      message: 'Membership request submitted. Awaiting admin approval.',
      membership: {
        communityId,
        memberDid,
        status: 'pending',
        joinedAt: now,
        memberRecordUri,
      },
    })
  }

  async approve(ctx: HttpContext) {
    const communityId = ctx.params.id as string
    const memberDid = ctx.params.did as string
    const now = nowIso()

    const adminDid = await getSessionDid(ctx)
    const community = getCommunity(communityId)
    if (!community) {
      throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
    }

    if (!isAdmin(communityId, adminDid)) {
      throw appError('Only admins can approve memberships', 403, 'NOT_ADMIN')
    }

    const db = getDb()
    const result = db
      .prepare(
        "UPDATE community_memberships SET status = 'active', joined_at = ? WHERE community_id = ? AND member_did = ? AND status = 'pending'"
      )
      .run(now, communityId, memberDid)

    if (result.changes === 0) {
      throw appError('Pending membership not found', 404, 'MEMBERSHIP_NOT_FOUND')
    }

    // Two-way handshake: write member record to community's repo
    let groupRecordUri: string | null = null
    try {
      const groupRecord = await addCommunityMemberRecord(communityId, memberDid, now)
      groupRecordUri = groupRecord.uri
    } catch {
      // Best-effort: PDS sync failure shouldn't block membership approval
    }

    // Two-way handshake: write membership record to member's repo
    let memberRecordUri: string | null = null
    try {
      const memberRecord = await xrpcRequest(memberDid, 'com.atproto.repo.createRecord', {
        method: 'POST',
        body: JSON.stringify({
          repo: memberDid,
          collection: 'app.m8.community.membership',
          record: {
            $type: 'app.m8.community.membership',
            communityDid: community.did,
            status: 'active',
            joinedAt: now,
            ...(groupRecordUri ? { communityRecordUri: groupRecordUri } : {}),
          },
        }),
      }) as { uri: string; cid: string }
      memberRecordUri = memberRecord.uri
    } catch {
      // Best-effort: member's PDS might not be accessible
    }

    // Update URIs in local DB
    if (groupRecordUri || memberRecordUri) {
      db.prepare(
        'UPDATE community_memberships SET group_record_uri = ?, membership_record_uri = ? WHERE community_id = ? AND member_did = ?'
      ).run(groupRecordUri, memberRecordUri, communityId, memberDid)
    }

    return ctx.response.send({
      message: 'Membership approved.',
      membership: {
        communityId,
        memberDid,
        status: 'active',
        joinedAt: now,
        groupRecordUri,
        memberRecordUri,
      },
    })
  }

  async reject(ctx: HttpContext) {
    const communityId = ctx.params.id as string
    const memberDid = ctx.params.did as string

    const adminDid = await getSessionDid(ctx)
    const community = getCommunity(communityId)
    if (!community) {
      throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
    }

    if (!isAdmin(communityId, adminDid)) {
      throw appError('Only admins can reject memberships', 403, 'NOT_ADMIN')
    }

    const db = getDb()
    const result = db
      .prepare(
        "DELETE FROM community_memberships WHERE community_id = ? AND member_did = ? AND status = 'pending'"
      )
      .run(communityId, memberDid)

    if (result.changes === 0) {
      throw appError('Pending membership not found', 404, 'MEMBERSHIP_NOT_FOUND')
    }

    return ctx.response.send({ message: 'Membership request rejected.' })
  }

  async leave(ctx: HttpContext) {
    const communityId = ctx.params.id as string
    const memberDid = await getSessionDid(ctx)
    const now = nowIso()

    const community = getCommunity(communityId)
    if (!community) {
      throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
    }

    const db = getDb()
    const result = db
      .prepare(
        "UPDATE community_memberships SET status = 'left', left_at = ? WHERE community_id = ? AND member_did = ? AND status = 'active'"
      )
      .run(now, communityId, memberDid)

    if (result.changes === 0) {
      throw appError('Active membership not found', 404, 'MEMBERSHIP_NOT_FOUND')
    }

    return ctx.response.send({ message: 'You have left the community.' })
  }
}
