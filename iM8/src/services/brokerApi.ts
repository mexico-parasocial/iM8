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
}

const SESSION_TOKEN_KEY = 'm8_broker_session_token'

let currentSessionToken: string | null = null
let cachedSession: IdentitySession | null = null

function getDefaultBrokerBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8787'
  }
  return 'http://127.0.0.1:8787'
}

function getBrokerBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_M8_BROKER_URL?.trim()
  return configured && configured.length > 0
    ? configured
    : getDefaultBrokerBaseUrl()
}

async function loadPersistedSessionToken() {
  if (currentSessionToken) {
    return currentSessionToken
  }

  const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY)
  currentSessionToken = token
  return token
}

async function persistSessionToken(token: string | null) {
  currentSessionToken = token

  if (token) {
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, token)
  } else {
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY)
  }
}

function readSessionTokenFromResponse(response: Response, payload: unknown) {
  const fromHeader = response.headers.get('x-m8-session-id')
  if (fromHeader) return fromHeader

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  if (typeof record.sessionId === 'string') return record.sessionId
  if (typeof record.sessionToken === 'string') return record.sessionToken

  const session = record.session
  if (
    session &&
    typeof session === 'object' &&
    typeof (session as { sessionId?: string }).sessionId === 'string'
  ) {
    return (session as { sessionId: string }).sessionId
  }

  const attempt = record.attempt
  if (
    attempt &&
    typeof attempt === 'object' &&
    typeof (attempt as { sessionId?: string }).sessionId === 'string'
  ) {
    return (attempt as { sessionId: string }).sessionId
  }

  return null
}

async function requestJson<T>(
  path: string,
  init: BrokerRequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  const token = init.token ?? (await loadPersistedSessionToken())
  if (token) {
    headers.set('x-m8-session-id', token)
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${getBrokerBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : null
  const nextToken = readSessionTokenFromResponse(response, payload)
  if (nextToken) {
    await persistSessionToken(nextToken)
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
    '/session/start',
    {
      method: 'POST',
      body: JSON.stringify(input),
      token: null,
    }
  )

  cacheSession(mapCurrentSession(response.session))

  return {
    identity: {
      did: response.attempt.did,
      handle: response.attempt.handle,
      authorizationServer: response.attempt.authorizationServer,
      phaseLabel: response.attempt.phaseLabel,
      provider: 'bsky',
    },
    authUrl: response.attempt.authUrl,
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
  >('/session/current')
  const sessionPayload = 'session' in response ? response.session : response
  const mapped = attachLedger(mapCurrentSession(sessionPayload), response)
  cacheSession(mapped)
  return mapped
}

export async function restoreCurrentSession(): Promise<IdentitySession | null> {
  const token = await loadPersistedSessionToken()
  if (!token) {
    return null
  }

  try {
    return await getCurrentSession()
  } catch {
    await persistSessionToken(null)
    cacheSession(null)
    return null
  }
}

export async function postGrantRequest(
  input: GrantRequestInput
): Promise<ClaimRequest> {
  const response = await requestJson<
    ProofBrokerClaimRequest | { request: ProofBrokerClaimRequest; session?: ProofBrokerSession }
  >('/grants/request', {
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
  const response = await requestJson<{ proofs: VerifyClaimResult[] }>(
    '/claims/verify',
    {
      method: 'POST',
      body: JSON.stringify({ requestId: id }),
    }
  )

  return response.proofs
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
  await persistSessionToken(null)
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
