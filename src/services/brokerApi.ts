import { secureGet, secureSet, secureDelete } from './secureStorage'
import { Platform } from 'react-native'
import type {
  ProofBrokerSession,
  ProofBrokerSessionStartResponse,
  ProofBrokerClaimRequest,
  ProofBrokerGrant,
  ProofBrokerParaProviderStatus,
} from '../contracts/proofBroker'
import type {
  AppGrant,
  ClaimRequest,
  GrantRequestInput,
  IdentitySession,
  ParaProviderStatus,
  StartSessionRequest,
  StartSessionResponse,
  VerifyClaimResult,
} from '../types'
import {
  mapCurrentSession,
  attachLedger,
  toContractGrantRequest,
  extractPendingRequest,
  extractGrant,
  clone,
  toParaProvider,
} from './brokerApi/mappers'
import {
  saveLocalSession,
  loadLocalSession,
  clearLocalSession,
  buildLocalSession,
} from './localSession'
import { enrollNewIdentity } from './identityEnrollment'

type BrokerRequestInit = RequestInit & {
  token?: string | null
  skipRefresh?: boolean
}

const ACCESS_TOKEN_KEY = 'm8_broker_access_token'
const REFRESH_TOKEN_KEY = 'm8_broker_refresh_token'
const LEGACY_SESSION_TOKEN_KEY = 'm8_broker_session_token'

let currentAccessToken: string | null = null
let currentRefreshToken: string | null = null
let cachedSession: IdentitySession | null = null

function getDefaultBrokerBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8787'
  }
  return 'http://127.0.0.1:8787'
}

function getBrokerBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_M8_BROKER_URL?.trim()
  const baseUrl = configured && configured.length > 0
    ? configured
    : getDefaultBrokerBaseUrl()
  if (!configured && __DEV__) {
    // Loopback reaches the dev machine from a simulator (it shares the host's
    // network stack) but on a physical device it is the phone itself, and
    // 10.0.2.2 only exists inside the Android emulator. Every broker call
    // fails with a connection error that looks like the broker is down.
    console.warn(
      `[brokerApi] EXPO_PUBLIC_M8_BROKER_URL not set; using ${baseUrl}. ` +
        'This only works on a simulator/emulator. On a physical device set it ' +
        'to your dev machine LAN address (e.g. http://192.168.0.4:8787) in .env.local.',
    )
  }
  const trimmed = baseUrl.replace(/\/+$/, '')
  return /\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/v1`
}

async function loadPersistedAccessToken() {
  if (currentAccessToken) {
    return currentAccessToken
  }

  const token =
    (await secureGet(ACCESS_TOKEN_KEY)) ??
    (await secureGet(LEGACY_SESSION_TOKEN_KEY))
  currentAccessToken = token
  return token
}

async function loadPersistedRefreshToken() {
  if (currentRefreshToken) {
    return currentRefreshToken
  }

  const token = await secureGet(REFRESH_TOKEN_KEY)
  currentRefreshToken = token
  return token
}

async function persistTokenBundle(tokens: {
  accessToken?: string | null
  refreshToken?: string | null
} | null) {
  currentAccessToken = tokens?.accessToken ?? null
  currentRefreshToken = tokens?.refreshToken ?? null

  if (tokens?.accessToken) {
    await secureSet(ACCESS_TOKEN_KEY, tokens.accessToken)
  } else {
    await secureDelete(ACCESS_TOKEN_KEY)
    await secureDelete(LEGACY_SESSION_TOKEN_KEY)
  }

  if (tokens?.refreshToken) {
    await secureSet(REFRESH_TOKEN_KEY, tokens.refreshToken)
  } else {
    await secureDelete(REFRESH_TOKEN_KEY)
  }
}

function readTokenBundleFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const tokens = record.tokens
  if (
    tokens &&
    typeof tokens === 'object' &&
    typeof (tokens as { accessToken?: string }).accessToken === 'string'
  ) {
    return tokens as { accessToken: string; refreshToken?: string | null }
  }

  if (
    typeof record.accessToken === 'string' ||
    typeof record.refreshToken === 'string'
  ) {
    return {
      accessToken: record.accessToken as string | undefined,
      refreshToken: record.refreshToken as string | undefined,
    }
  }

  return null
}

async function refreshBrokerAccessToken() {
  const refreshToken = await loadPersistedRefreshToken()
  if (!refreshToken) return false

  const response = await fetch(`${getBrokerBaseUrl()}/sessions/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  const text = await response.text()
  const payload = parseJsonPayload(text)

  if (!response.ok) {
    await persistTokenBundle(null)
    return false
  }

  const tokens = readTokenBundleFromPayload(payload)
  if (!tokens?.accessToken) {
    await persistTokenBundle(null)
    return false
  }

  await persistTokenBundle(tokens)
  return true
}

function parseJsonPayload(text: string) {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function requestJson<T>(
  path: string,
  init: BrokerRequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  const token = init.token ?? (await loadPersistedAccessToken())
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${getBrokerBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const payload = parseJsonPayload(text)
  const tokens = readTokenBundleFromPayload(payload)
  if (tokens?.accessToken) {
    await persistTokenBundle(tokens)
  }

  if (response.status === 401 && !init.skipRefresh && await refreshBrokerAccessToken()) {
    return requestJson<T>(path, { ...init, skipRefresh: true })
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object'
        ? ((payload as { error?: string; message?: string }).error ??
          (payload as { message?: string }).message ??
          `Broker request failed with ${response.status}`)
        : `Broker request failed with ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

function cacheSession(session: IdentitySession | null) {
  cachedSession = session ? clone(session) : null
}

export async function postSessionStart(
  input: StartSessionRequest
): Promise<StartSessionResponse> {
  const response = await requestJson<ProofBrokerSessionStartResponse>(
    '/sessions/start',
    {
      method: 'POST',
      body: JSON.stringify(input),
      token: null,
    }
  )

  if (response.session) {
    cacheSession(mapCurrentSession(response.session))
  }

  const attempt = response.attempt

  return {
    identity: {
      did: attempt.did ?? '',
      handle: attempt.handle ?? attempt.identifier ?? input.identifier,
      authorizationServer: attempt.authorizationServer ?? '',
      phaseLabel: attempt.phaseLabel,
      provider: 'bsky',
    },
    authUrl: response.oauthUrl ?? attempt.authUrl ?? '',
    sessionStub: {
      broker: 'm8',
      proofMode: 'proof-only',
    },
  }
}

export async function getCurrentSession(): Promise<IdentitySession> {
  const response = await requestJson<
    | ProofBrokerSession
    | { session: ProofBrokerSession; ledger?: IdentitySession['consentLedger'] }
  >('/sessions/me')
  const sessionPayload = 'session' in response ? response.session : response
  const mapped = attachLedger(mapCurrentSession(sessionPayload), response)
  cacheSession(mapped)
  return mapped
}

export async function restoreCurrentSession(): Promise<IdentitySession | null> {
  const token = await loadPersistedAccessToken()
  if (!token) {
    return null
  }

  try {
    return await getCurrentSession()
  } catch {
    await persistTokenBundle(null)
    cacheSession(null)
    return null
  }
}

export async function postGrantRequest(
  input: GrantRequestInput
): Promise<ClaimRequest> {
  const response = await requestJson<
    | ProofBrokerClaimRequest
    | { request: ProofBrokerClaimRequest; session?: ProofBrokerSession }
    | { grant: ProofBrokerGrant; session?: ProofBrokerSession }
  >('/grants', {
    method: 'POST',
    body: JSON.stringify(toContractGrantRequest(input)),
  })

  if ('session' in response && response.session) {
    cacheSession(mapCurrentSession(response.session))
  }

  return extractPendingRequest(
    'request' in response ? response : { request: response }
  )
}

export async function postGrantApprove(id: string): Promise<AppGrant> {
  const response = await requestJson<{
    session: ProofBrokerSession
    grant: ProofBrokerGrant
  }>(`/grants/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ grantId: id }),
  })

  cacheSession(mapCurrentSession(response.session))
  return extractGrant(response)
}

export async function postGrantRevoke(id: string): Promise<AppGrant> {
  const response = await requestJson<{
    session: ProofBrokerSession
    grant: ProofBrokerGrant
  }>(`/grants/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ grantId: id }),
  })

  cacheSession(mapCurrentSession(response.session))
  return extractGrant(response)
}

export async function postClaimVerify(id: string): Promise<VerifyClaimResult[]> {
  const request = cachedSession?.pendingRequests.find((item) => item.id === id)
  const claimType = request?.requestedClaims[0]

  if (!request || !claimType) {
    throw new Error('Claim request not found for verification')
  }

  const response = await requestJson<{
    proofId: string
    outcome: string
    statement: string
    reference: string | null
  }>(
    `/claims/${encodeURIComponent(id)}/verify`,
    {
      method: 'POST',
      body: JSON.stringify({
        claimType,
        audienceAppId: request.appId,
        audienceAppName: request.appName,
        surface: request.surface,
        proofMode: 'proof-only',
        verifierId: request.verifier === 'PARA verifier' ? 'para.identity' : 'm8.broker',
        reason: request.reason,
      }),
    }
  )

  return [
    {
      artifact: {
        id: response.proofId,
        claimType,
        label: claimType,
        issuer: request.verifier,
        verifier: 'm8 broker',
        audienceAppId: request.appId,
        proofRef: response.reference ?? '',
        summary: response.statement,
        issuedAt: 'Now',
        expiresAt: request.expiresAt ?? 'No expiry',
        status: response.outcome === 'not-verified' ? 'Expired' : 'Active',
      },
      detail: response.statement,
    },
  ]
}

export async function getParaProviderStatus(): Promise<ParaProviderStatus> {
  const response = await requestJson<
    | ProofBrokerParaProviderStatus
    | {
        providerStatus?: ProofBrokerParaProviderStatus
        paraProvider?: ProofBrokerParaProviderStatus
      }
  >('/providers/para/status')

  if ('providerId' in response) {
    return toParaProvider(response)
  }

  const provider = response.providerStatus ?? response.paraProvider
  if (!provider) {
    throw new Error('Broker response missing PARA status')
  }

  return toParaProvider(provider)
}

export function getCachedSession() {
  return cachedSession ? clone(cachedSession) : null
}

export async function clearPersistedSession() {
  await persistTokenBundle(null)
  cacheSession(null)
  await clearLocalSession()
}

/**
 * Creates a local session backed by a real key.
 *
 * Enrollment comes first: the device generates and stores a seed, and the
 * session's DID names the resulting public key. Previously the DID was built
 * from the typed handle, so the "identity" was a formatted string and the
 * seed vault was never touched.
 *
 * If this device cannot hold a key (no hardware keystore — notably web),
 * enrollment throws and the caller surfaces that rather than handing back a
 * keyless session that looks identical to a real one.
 */
export async function createNativeSession(handle: string): Promise<IdentitySession> {
  const enrolled = await enrollNewIdentity()
  const session = buildLocalSession(handle, enrolled.did)
  cacheSession(session)
  await saveLocalSession(session)
  return session
}

export async function restoreNativeSession(): Promise<IdentitySession | null> {
  return loadLocalSession()
}

export async function persistSessionSnapshot(session: IdentitySession): Promise<IdentitySession> {
  cacheSession(session)
  if (session.brokerMode === 'local') {
    await saveLocalSession(session)
  }
  return clone(session)
}

export type AnonymousVoiceCard = {
  id: string
  displayName: string
  avatarSeed: string
  status: 'active' | 'archived'
  burnAfter: 'none' | 'post'
  tier: 'main' | 'burner'
  posts: unknown[]
}

/**
 * The user's anonymous voices, tiered by the server: the followable "main
 * voice" (default profile) and unlinkable burner identities.
 */
export async function getAnonymousIdentities(): Promise<AnonymousVoiceCard[]> {
  const response = await requestJson<{ identities: AnonymousVoiceCard[] }>(
    '/anonymous/identities'
  )
  return response.identities
}
