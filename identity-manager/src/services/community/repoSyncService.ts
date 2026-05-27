import { getDb } from '../../db/connection.js'
import { getCommunity } from '../communityService.js'
import { resolvePdsEndpoint } from '../didResolver.js'
import { appError } from '../../utils/errors.js'

/**
 * Resolve the PDS endpoint for a community and make an authenticated XRPC request.
 * Uses the community's stored pds_auth_token for Bearer authentication.
 */
async function communityXrpcRequest(
  communityId: string,
  method: string,
  init: RequestInit = {},
): Promise<unknown> {
  const db = getDb()
  const row = db
    .prepare('SELECT did, pds_host, pds_auth_token FROM communities WHERE id = ?')
    .get(communityId) as Record<string, unknown> | undefined

  if (!row) {
    throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
  }

  const did = row.did as string
  const pdsHost = (row.pds_host as string) || ''
  const authToken = (row.pds_auth_token as string) || ''

  if (!pdsHost) {
    throw appError('Community has no PDS configured', 503, 'COMMUNITY_PDS_MISSING')
  }

  let pds = pdsHost
  if (!pds) {
    const resolved = await resolvePdsEndpoint(did)
    if (resolved) pds = resolved
  }

  if (!pds) {
    throw appError('Could not resolve PDS endpoint for community', 503, 'PDS_NOT_FOUND')
  }

  const base = pds.endsWith('/') ? pds.slice(0, -1) : pds
  const url = `${base}/xrpc/${method}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(init.headers as Record<string, string> || {}),
  }

  const response = await fetch(url, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const body = await response.text()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(body) as Record<string, unknown>
    } catch {
      // ignore
    }
    const message = parsed?.message ?? body ?? `XRPC request failed: ${response.status}`
    throw appError(message as string, response.status, (parsed?.error as string) || 'XRPC_ERROR')
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return { success: true }
}

/**
 * Write a record to the community's ATProto repo.
 */
export async function writeCommunityRecord(
  communityId: string,
  collection: string,
  record: Record<string, unknown>,
  rkey?: string,
): Promise<{ uri: string; cid: string }> {
  const body: Record<string, unknown> = {
    repo: (getCommunity(communityId)?.did) as string,
    collection,
    record: {
      $type: collection,
      ...record,
    },
  }

  if (rkey) {
    body.rkey = rkey
  }

  const result = await communityXrpcRequest(communityId, 'com.atproto.repo.createRecord', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as { uri: string; cid: string }

  return result
}

/**
 * Read a record from the community's ATProto repo.
 */
export async function getCommunityRecord(
  communityId: string,
  collection: string,
  rkey: string,
): Promise<unknown> {
  const community = getCommunity(communityId)
  if (!community) {
    throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
  }

  return communityXrpcRequest(communityId, 'com.atproto.repo.getRecord', {
    method: 'GET',
    body: JSON.stringify({
      repo: community.did,
      collection,
      rkey,
    }),
  })
}

/**
 * Update the community's settings record on its PDS repo.
 */
export async function syncCommunitySettingsToRepo(communityId: string): Promise<{ uri: string; cid: string }> {
  const community = getCommunity(communityId)
  if (!community) {
    throw appError('Community not found', 404, 'COMMUNITY_NOT_FOUND')
  }

  const record = {
    name: community.name,
    description: community.description,
    status: community.status,
    ...(community.politicalCompassX !== null && community.politicalCompassY !== null
      ? {
          politicalCompass: {
            x: community.politicalCompassX,
            y: community.politicalCompassY,
          },
        }
      : {}),
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
  }

  return writeCommunityRecord(communityId, 'app.m8.community.settings', record, 'self')
}

/**
 * Write the community manifesto to its repo.
 */
export async function syncCommunityManifestoToRepo(
  communityId: string,
  text: string,
  actionUri?: string,
): Promise<{ uri: string; cid: string }> {
  const record = {
    text,
    version: 1,
    updatedAt: new Date().toISOString(),
    ...(actionUri ? { actionUri } : {}),
  }

  return writeCommunityRecord(communityId, 'app.m8.community.manifesto', record, 'self')
}

/**
 * Write the community ruleset to its repo.
 */
export async function syncCommunityRulesetToRepo(
  communityId: string,
  text: string,
  actionUri?: string,
): Promise<{ uri: string; cid: string }> {
  const record = {
    text,
    version: 1,
    updatedAt: new Date().toISOString(),
    ...(actionUri ? { actionUri } : {}),
  }

  return writeCommunityRecord(communityId, 'app.m8.community.ruleset', record, 'self')
}

/**
 * Write a blog post to the community's repo.
 */
export async function publishCommunityBlogPost(
  communityId: string,
  title: string,
  content: string,
  authorDid: string,
  actionUri?: string,
): Promise<{ uri: string; cid: string }> {
  const record = {
    title,
    content,
    authorDid,
    createdAt: new Date().toISOString(),
    ...(actionUri ? { actionUri } : {}),
  }

  return writeCommunityRecord(communityId, 'app.m8.community.blogPost', record)
}

/**
 * Write a member record to the community's repo.
 */
export async function addCommunityMemberRecord(
  communityId: string,
  memberDid: string,
  joinedAt: string,
): Promise<{ uri: string; cid: string }> {
  const record = {
    memberDid,
    status: 'active',
    joinedAt,
  }

  const rkey = memberDid.replace(/:/g, '_')
  return writeCommunityRecord(communityId, 'app.m8.community.member', record, rkey)
}
