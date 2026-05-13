import { NodeOAuthClient, JoseKey } from '@atproto/oauth-client-node'
import type { NodeSavedState, NodeSavedSession } from '@atproto/oauth-client-node'
import { env } from '../config/env.js'
import { getDb } from '../db/connection.js'

// ─── OAuth State & Session Storage (SQLite-backed) ─────────────────────────

class SQLiteStateStore {
  get db() {
    return getDb()
  }

  async get(key: string): Promise<NodeSavedState | undefined> {
    const row = this.db.prepare('SELECT value FROM oauth_state WHERE key = ?').get(key) as { value: string } | undefined
    if (!row) return undefined
    try {
      return JSON.parse(row.value) as NodeSavedState
    } catch {
      return undefined
    }
  }

  async set(key: string, value: NodeSavedState): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min
    this.db.prepare(`
      INSERT INTO oauth_state (key, value, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        expires_at = excluded.expires_at
    `).run(key, JSON.stringify(value), expiresAt)
  }

  async del(key: string): Promise<void> {
    this.db.prepare('DELETE FROM oauth_state WHERE key = ?').run(key)
  }
}

class SQLiteSessionStore {
  get db() {
    return getDb()
  }

  async get(key: string): Promise<NodeSavedSession | undefined> {
    const row = this.db.prepare('SELECT value FROM oauth_session WHERE key = ?').get(key) as { value: string } | undefined
    if (!row) return undefined
    try {
      return JSON.parse(row.value) as NodeSavedSession
    } catch {
      return undefined
    }
  }

  async set(key: string, value: NodeSavedSession): Promise<void> {
    this.db.prepare(`
      INSERT INTO oauth_session (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value
    `).run(key, JSON.stringify(value))
  }

  async del(key: string): Promise<void> {
    this.db.prepare('DELETE FROM oauth_session WHERE key = ?').run(key)
  }
}

// ─── OAuth Client Factory ──────────────────────────────────────────────────

let oauthClientInstance: NodeOAuthClient | null = null

export async function getOAuthClient(): Promise<NodeOAuthClient> {
  if (oauthClientInstance) return oauthClientInstance

  // Ensure OAuth tables exist
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at TEXT NOT NULL DEFAULT (datetime('now', '+10 minutes'))
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_state_expires ON oauth_state(expires_at);

    CREATE TABLE IF NOT EXISTS oauth_session (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const stateStore = new SQLiteStateStore()
  const sessionStore = new SQLiteSessionStore()

  let keyset: JoseKey[] | undefined
  if (env.PRIVATE_KEYS) {
    try {
      const jwks = JSON.parse(env.PRIVATE_KEYS)
      const keys = Array.isArray(jwks) ? jwks : [jwks]
      keyset = await Promise.all(keys.map((k) => JoseKey.fromJWK(k)))
    } catch {
      console.warn('[atprotoAuth] Failed to parse PRIVATE_KEYS, using no keyset')
    }
  }

  const clientMetadata = {
    client_name: 'M8 Identity Manager',
    client_uri: env.SERVICE_URL,
    redirect_uris: [`${env.SERVICE_URL}/v1/sessions/oauth/callback`] as [string, ...string[]],
    scope: 'atproto transition:generic',
    grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
    response_types: ['code'] as ['code'],
    token_endpoint_auth_method: (keyset ? 'private_key_jwt' : 'none') as 'private_key_jwt' | 'none',
    application_type: 'web' as const,
    dpop_bound_access_tokens: true,
  }

  oauthClientInstance = new NodeOAuthClient({
    clientMetadata,
    keyset,
    stateStore,
    sessionStore,
    plcDirectoryUrl: env.PLC_URL,
    allowHttp: env.NODE_ENV === 'development',
  })

  return oauthClientInstance
}

export async function initiateOAuthLogin(handleOrDid: string): Promise<{ url: string; state: string }> {
  const client = await getOAuthClient()
  const url = await client.authorize(handleOrDid, {
    scope: 'atproto transition:generic',
  })

  // Extract state from URL for our own session tracking
  const state = url.searchParams.get('state') ?? `state-${Date.now()}`
  return { url: url.toString(), state }
}

export async function completeOAuthCallback(params: URLSearchParams): Promise<{ did: string; session: unknown }> {
  const client = await getOAuthClient()
  const result = await client.callback(params)

  if (!result.session) {
    throw new Error('OAuth callback did not return a session')
  }

  return {
    did: result.session.did,
    session: result.session,
  }
}

export async function restoreOAuthSession(did: string): Promise<unknown | null> {
  const client = await getOAuthClient()
  try {
    return await client.restore(did)
  } catch {
    return null
  }
}
