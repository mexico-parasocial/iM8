import { generateKeyPairSync } from 'node:crypto'
import { getDb } from '../../db/connection.js'
import { appError } from '../../utils/errors.js'

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

  const pem = community.signingKeyPublic
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const rawKey = Buffer.from(base64, 'base64')

  // Ed25519 SPKI: 30 2a 30 05 06 03 2b 65 70 03 21 00 <32 bytes key>
  const keyBytes = rawKey.slice(-32)

  const did = community.did
  const handle = community.handle

  return {
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
