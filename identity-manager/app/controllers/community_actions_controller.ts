import type { HttpContext } from '@adonisjs/core/http'
import { getSessionId, validateBody } from '#support/http'
import { getDb } from '../../src/db/connection.js'
import {
  proposeAction,
  voteOnAction,
  getAction,
  listActions,
} from '../../src/services/communityActionService.js'
import { getCommunity } from '../../src/services/communityService.js'
import { ProposeActionInputSchema, VoteActionInputSchema } from '../../src/types/index.js'

function appError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
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

export default class CommunityActionsController {
  async index(ctx: HttpContext) {
    const communityId = ctx.params.id as string
    const status = ctx.request.qs().status as string | undefined
    const limit = Math.min(parseInt(ctx.request.qs().limit as string) || 50, 100)
    const offset = parseInt(ctx.request.qs().offset as string) || 0

    const community = getCommunity(communityId)
    if (!community) {
      throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
    }

    const result = listActions(communityId, {
      status: status as 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | undefined,
      limit,
      offset,
    })

    return ctx.response.send({
      actions: result.actions,
      pagination: { total: result.total, limit, offset },
    })
  }

  async show(ctx: HttpContext) {
    const actionId = ctx.params.actionId as string
    const action = getAction(actionId)
    return ctx.response.send({ action })
  }

  async store(ctx: HttpContext) {
    const communityId = ctx.params.id as string
    const body = validateBody(ctx, ProposeActionInputSchema)
    if (!body) return

    const proposedByDid = await getSessionDid(ctx)
    const action = proposeAction(communityId, proposedByDid, body.actionType, body.payload)

    return ctx.response.status(201).send({ action })
  }

  async vote(ctx: HttpContext) {
    const actionId = ctx.params.actionId as string
    const body = validateBody(ctx, VoteActionInputSchema)
    if (!body) return

    const adminDid = await getSessionDid(ctx)
    const result = await voteOnAction(
      actionId,
      adminDid,
      body.vote,
      body.signature,
      body.signedAt,
      body.nonce,
      body.keyId
    )

    const statusCode = result.executed ? 200 : 202
    const message = result.executed
      ? 'Vote recorded. Action has been approved and executed.'
      : 'Vote recorded. Awaiting additional approvals.'

    return ctx.response.status(statusCode).send({
      message,
      action: result.action,
      executed: result.executed,
    })
  }
}
