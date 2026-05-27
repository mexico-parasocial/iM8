import { randomUUID } from 'node:crypto'
import { getDb } from '../db/connection.js'
import type {
  CommunityAction,
  CommunityActionStatus,
  CommunityActionType,
  CommunityActionVote,
  CommunityActionVoteRecord,
} from '../types/index.js'
import { COMMUNITY_ACTION_THRESHOLDS } from '../types/index.js'
import { getCommunity, updateCommunityFromPayload } from './communityService.js'
import { addAdmin, removeAdmin } from './communityAdminService.js'
import { assertIsAdmin, getAdminCount, isAdmin } from './communityAdminService.js'
import {
  syncCommunitySettingsToRepo,
  syncCommunityManifestoToRepo,
  syncCommunityRulesetToRepo,
  publishCommunityBlogPost,
} from './communityAgentService.js'
import { verifyCommunityVoteSignature } from './communityVoteSignatureService.js'

function appError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

function nowIso() {
  return new Date().toISOString()
}

function mapAction(row: Record<string, unknown>): CommunityAction {
  return {
    id: row.id as string,
    communityId: row.community_id as string,
    actionType: row.action_type as CommunityActionType,
    impactLevel: row.impact_level as 'low' | 'high',
    payload: JSON.parse((row.payload as string) || '{}'),
    proposedByDid: row.proposed_by_did as string,
    status: row.status as CommunityActionStatus,
    requiredApprovals: row.required_approvals as number,
    currentApprovals: row.current_approvals as number,
    repoCommitCid: (row.repo_commit_cid as string) ?? null,
    createdAt: row.created_at as string,
    executedAt: (row.executed_at as string) ?? null,
    failedReason: (row.failed_reason as string) ?? null,
  }
}

function mapVote(row: Record<string, unknown>): CommunityActionVoteRecord {
  return {
    actionId: row.action_id as string,
    adminDid: row.admin_did as string,
    vote: row.vote as CommunityActionVote,
    voteSignature: row.vote_signature as string,
    signedAt: (row.signed_at as string) ?? null,
    signedPayloadHash: (row.signed_payload_hash as string) ?? null,
    verificationMethodId: (row.verification_method_id as string) ?? null,
    signatureNonce: (row.signature_nonce as string) ?? null,
    votedAt: row.voted_at as string,
  }
}

function getRequiredApprovals(actionType: CommunityActionType, adminCount: number): number {
  const threshold = COMMUNITY_ACTION_THRESHOLDS[actionType]
  if (!threshold) {
    throw appError(`Unknown action type: ${actionType}`, 400, 'UNKNOWN_ACTION_TYPE')
  }
  // High-impact requires unanimous among current admins (minimum 3)
  if (threshold.impact === 'high') {
    return Math.max(threshold.required, adminCount)
  }
  return threshold.required
}

export function proposeAction(
  communityId: string,
  proposedByDid: string,
  actionType: CommunityActionType,
  payload: Record<string, unknown>
): CommunityAction {
  const db = getDb()
  const now = nowIso()

  const community = getCommunity(communityId)
  if (!community) {
    throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
  }

  if (community.status !== 'active') {
    throw appError(
      `Community must be active to propose actions. Current status: ${community.status}`,
      409,
      'COMMUNITY_NOT_ACTIVE'
    )
  }

  assertIsAdmin(communityId, proposedByDid)

  const adminCount = getAdminCount(communityId)
  const requiredApprovals = getRequiredApprovals(actionType, adminCount)

  // For admin_add actions, validate the payload
  if (actionType === 'admin_add') {
    const newAdminDid = payload.adminDid as string
    if (!newAdminDid) {
      throw appError('adminDid is required for admin_add actions', 422, 'MISSING_ADMIN_DID')
    }
    if (isAdmin(communityId, newAdminDid)) {
      throw appError('This DID is already an admin', 409, 'ADMIN_ALREADY_EXISTS')
    }
  }

  // For admin_remove actions, validate the payload
  if (actionType === 'admin_remove') {
    const removeAdminDid = payload.adminDid as string
    if (!removeAdminDid) {
      throw appError('adminDid is required for admin_remove actions', 422, 'MISSING_ADMIN_DID')
    }
    if (removeAdminDid === proposedByDid) {
      throw appError('You cannot remove yourself via action. Use leave instead.', 409, 'SELF_REMOVE_NOT_ALLOWED')
    }
    if (!isAdmin(communityId, removeAdminDid)) {
      throw appError('This DID is not an admin', 404, 'ADMIN_NOT_FOUND')
    }
    if (adminCount <= 3) {
      throw appError(
        'Cannot remove admin: community must maintain at least 3 admins',
        409,
        'MIN_ADMINS_REQUIRED'
      )
    }
  }

  const actionId = `action-${randomUUID()}`

  db.prepare(`
    INSERT INTO community_actions (id, community_id, action_type, impact_level, payload, proposed_by_did, status, required_approvals, current_approvals, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actionId,
    communityId,
    actionType,
    COMMUNITY_ACTION_THRESHOLDS[actionType].impact,
    JSON.stringify(payload),
    proposedByDid,
    'pending',
    requiredApprovals,
    0,
    now
  )

  const row = db.prepare('SELECT * FROM community_actions WHERE id = ?').get(actionId) as Record<string, unknown>
  return mapAction(row)
}

export async function voteOnAction(
  actionId: string,
  adminDid: string,
  vote: CommunityActionVote,
  signature: string,
  signedAt: string,
  nonce: string,
  keyId?: string
): Promise<{ action: CommunityAction; executed: boolean }> {
  const db = getDb()
  const now = nowIso()

  const actionRow = db.prepare('SELECT * FROM community_actions WHERE id = ?').get(actionId) as
    | Record<string, unknown>
    | undefined
  if (!actionRow) {
    throw appError('Action not found', 404, 'ACTION_NOT_FOUND')
  }

  const action = mapAction(actionRow)

  if (action.status !== 'pending') {
    throw appError(`Action is already ${action.status}`, 409, 'ACTION_NOT_PENDING')
  }

  assertIsAdmin(action.communityId, adminDid)

  const verification = await verifyCommunityVoteSignature({
    action,
    adminDid,
    vote,
    signature,
    signedAt,
    nonce,
    keyId,
  })

  // Check if already voted
  const existingVote = db
    .prepare('SELECT 1 FROM community_action_votes WHERE action_id = ? AND admin_did = ?')
    .get(actionId, adminDid) as Record<string, unknown> | undefined

  if (existingVote) {
    throw appError('You have already voted on this action', 409, 'ALREADY_VOTED')
  }

  let newStatus: CommunityActionStatus = 'pending'
  let newApprovalCount = 0
  let shouldExecute = false

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO community_action_votes
          (action_id, admin_did, vote, vote_signature, signed_at, signed_payload_hash, verification_method_id, signature_nonce, voted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        actionId,
        adminDid,
        vote,
        signature,
        verification.payload.signedAt,
        verification.signedPayloadHash,
        verification.verificationMethodId,
        verification.payload.nonce,
        now
      )

      const approvalCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM community_action_votes WHERE action_id = ? AND vote = 'approve'"
        )
        .get(actionId) as Record<string, unknown>
      newApprovalCount = approvalCount.count as number

      const rejectionCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM community_action_votes WHERE action_id = ? AND vote = 'reject'"
        )
        .get(actionId) as Record<string, unknown>
      const newRejectionCount = rejectionCount.count as number

      const adminCount = getAdminCount(action.communityId)

      if (newApprovalCount >= action.requiredApprovals) {
        newStatus = 'approved'
        shouldExecute = true
      } else if (newRejectionCount > adminCount - action.requiredApprovals) {
        // If rejections make it impossible to reach threshold
        newStatus = 'rejected'
      }

      db.prepare(
        'UPDATE community_actions SET status = ?, current_approvals = ? WHERE id = ?'
      ).run(newStatus, newApprovalCount, actionId)
    })()
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: community_action_votes.signature_nonce')) {
      throw appError('Vote signature nonce has already been used', 409, 'SIGNATURE_NONCE_REUSED')
    }
    throw error
  }

  action.status = newStatus
  action.currentApprovals = newApprovalCount

  // If approved, execute immediately
  let executed = false
  if (shouldExecute) {
    executed = await executeApprovedAction(action)
  }

  return { action, executed }
}

async function executeApprovedAction(action: CommunityAction): Promise<boolean> {
  const db = getDb()
  const now = nowIso()

  try {
    // 1. Apply local changes
    switch (action.actionType) {
      case 'name_change':
      case 'compass_change':
      case 'manifesto_update':
      case 'ruleset_mod': {
        updateCommunityFromPayload(action.communityId, action.payload)
        break
      }
      case 'admin_add': {
        addAdmin(action.communityId, action.payload.adminDid as string, action.proposedByDid)
        break
      }
      case 'admin_remove': {
        removeAdmin(action.communityId, action.payload.adminDid as string, action.proposedByDid)
        break
      }
      case 'blog_post': {
        // Local state already captured in action payload; PDS sync below
        break
      }
    }

    // 2. Sync to ATProto repo (best-effort)
    let syncError: string | null = null
    try {
      await syncActionToPdsRepo(action)
    } catch (pdsErr) {
      syncError = pdsErr instanceof Error ? pdsErr.message : String(pdsErr)
      // Don't fail the action just because PDS sync failed
    }

    db.prepare(
      'UPDATE community_actions SET status = ?, executed_at = ?, failed_reason = ? WHERE id = ?'
    ).run('executed', now, syncError, action.id)
    return true
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    db.prepare(
      'UPDATE community_actions SET status = ?, failed_reason = ? WHERE id = ?'
    ).run('failed', errorMessage, action.id)
    return false
  }
}

async function syncActionToPdsRepo(action: CommunityAction): Promise<void> {
  const community = getCommunity(action.communityId)
  if (!community) return
  if (!community.pdsHost) return // No PDS configured, skip

  switch (action.actionType) {
    case 'name_change':
    case 'compass_change': {
      await syncCommunitySettingsToRepo(action.communityId)
      break
    }
    case 'manifesto_update': {
      const text = (action.payload.text as string) || ''
      await syncCommunityManifestoToRepo(action.communityId, text)
      break
    }
    case 'ruleset_mod': {
      const text = (action.payload.text as string) || ''
      await syncCommunityRulesetToRepo(action.communityId, text)
      break
    }
    case 'blog_post': {
      const title = (action.payload.title as string) || ''
      const content = (action.payload.content as string) || ''
      await publishCommunityBlogPost(action.communityId, title, content, action.proposedByDid)
      break
    }
    // admin_add and admin_remove don't need PDS sync for the action itself
    // (the member record is written when membership is approved)
  }
}

export function getAction(actionId: string): CommunityAction & { votes: CommunityActionVoteRecord[] } {
  const db = getDb()
  const row = db.prepare('SELECT * FROM community_actions WHERE id = ?').get(actionId) as
    | Record<string, unknown>
    | undefined
  if (!row) {
    throw appError('Action not found', 404, 'ACTION_NOT_FOUND')
  }

  const voteRows = db
    .prepare('SELECT * FROM community_action_votes WHERE action_id = ? ORDER BY voted_at ASC')
    .all(actionId) as Record<string, unknown>[]

  return {
    ...mapAction(row),
    votes: voteRows.map(mapVote),
  }
}

export function listActions(
  communityId: string,
  opts?: { status?: CommunityActionStatus; limit?: number; offset?: number }
): {
  actions: CommunityAction[]
  total: number
} {
  const db = getDb()
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0

  let whereClause = 'WHERE community_id = ?'
  const params: (string | number)[] = [communityId]

  if (opts?.status) {
    whereClause += ' AND status = ?'
    params.push(opts.status)
  }
  params.push(limit, offset)

  const rows = db
    .prepare(`SELECT * FROM community_actions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params) as Record<string, unknown>[]

  const countParams: (string | number)[] = [communityId]
  if (opts?.status) countParams.push(opts.status)

  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM community_actions ${whereClause}`)
    .get(...countParams) as Record<string, unknown>

  return {
    actions: rows.map(mapAction),
    total: (countRow.count as number) ?? 0,
  }
}
