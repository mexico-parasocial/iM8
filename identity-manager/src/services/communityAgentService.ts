import { generateKeyPairSync } from 'node:crypto'
import { getDb } from '../db/connection.js'
import { getCommunity } from './communityService.js'
import { resolvePdsEndpoint } from './didResolver.js'

function appError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

export interface CommunityKeyPair {
  publicKey: string // base64
  privateKey: string // base64
}

export interface CommunityDidDocument {
  '@context': string[]
  id: string
  alsoKnownAs?: string[]
  verificationMethod: Array<{
    id: string
    type: string
    controller: string
    publicKeyJwk: {
      kty: string
      crv: string
      x: string
    }
  }>
  service: Array<{
    id: string
    type: string
    serviceEndpoint: string
  }>
}

/**
 * Generate an Ed25519 keypair for a community.
 */
export function generateCommunityKeys(): CommunityKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return { publicKey, privateKey }
}

/**
 * Create a did:web DID document for a community.
 */
export function createDidDocument(community: {
  did: string
  handle: string | null
  pdsHost: string
  signingKeyPublic: string | null
}): CommunityDidDocument {
  if (!community.signingKeyPublic) {
    throw appError('Community has no signing key', 500, 'COMMUNITY_NO_SIGNING_KEY')
  }

  // Parse the PEM public key to get raw bytes for JWK
  const pem = community.signingKeyPublic
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const rawKey = Buffer.from(base64, 'base64')

  // Ed25519 SPKI: 30 2a 30 05 06 03 2b 65 70 03 21 00 <32 bytes key>
  // The actual key starts at offset 12
  const keyBytes = rawKey.slice(-32)

  const did = community.did
  const handle = community.handle

  const doc: CommunityDidDocument = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    alsoKnownAs: handle ? [`at://${handle}`] : undefined,
    verificationMethod: [
      {
        id: `${did}#atproto`,
        type: 'Multikey',
        controller: did,
        publicKeyJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: keyBytes.toString('base64url'),
        },
      },
    ],
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: community.pdsHost || 'https://bsky.social',
      },
    ],
  }

  return doc
}

/**
 * Generate and store a signing keypair for a community.
 */
export function provisionCommunityKeys(communityId: string): CommunityKeyPair {
  const db = getDb()
  const keys = generateCommunityKeys()

  db.prepare(
    'UPDATE communities SET signing_key_public = ?, signing_key_private = ? WHERE id = ?'
  ).run(keys.publicKey, keys.privateKey, communityId)

  return keys
}

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

  // Try to resolve PDS from DID doc if pds_host is not set
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

  // Use the member's DID as the rkey for idempotency
  const rkey = memberDid.replace(/:/g, '_')
  return writeCommunityRecord(communityId, 'app.m8.community.member', record, rkey)
}
