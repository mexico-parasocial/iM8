import AsyncStorage from '@react-native-async-storage/async-storage'
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
  const trimmed = baseUrl.replace(/\/+$/, '')
  return /\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/v1`
}

async function loadPersistedAccessToken() {
  if (currentAccessToken) {
    return currentAccessToken
  }

  const token =
    (await AsyncStorage.getItem(ACCESS_TOKEN_KEY)) ??
    (await AsyncStorage.getItem(LEGACY_SESSION_TOKEN_KEY))
  currentAccessToken = token
  return token
}

async function loadPersistedRefreshToken() {
  if (currentRefreshToken) {
    return currentRefreshToken
  }

  const token = await AsyncStorage.getItem(REFRESH_TOKEN_KEY)
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
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  } else {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY)
    await AsyncStorage.removeItem(LEGACY_SESSION_TOKEN_KEY)
  }

  if (tokens?.refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  } else {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY)
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

export async function createNativeSession(handle: string): Promise<IdentitySession> {
  const session = buildLocalSession(handle)
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
