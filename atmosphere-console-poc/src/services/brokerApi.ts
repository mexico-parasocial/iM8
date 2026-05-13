import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { buildCommandDeck, buildIntegrations, buildPersonas, buildSignalProviders, buildSurfaceTemplates } from '../poc-data'
import { buildClaimCatalog, buildConsentPolicy, buildPdsSafetyPolicy, buildProofLifecycleCopy, buildSafetyActions } from './trustPolicy'
import {
  proofBrokerClaimLabel,
  type ProofBrokerClaimRequest,
  type ProofBrokerClaimSpec,
  type ProofBrokerGrant,
  type ProofBrokerGrantRequestInput,
  type ProofBrokerParaProviderStatus,
  type ProofBrokerProofArtifact,
  type ProofBrokerSession,
  type ProofBrokerSessionStartResponse,
} from '../contracts/proofBroker'
import {
  type AppGrant,
  type ClaimRequest,
  type GrantRequestInput,
  type IdentitySession,
  type ParaProviderStatus,
  type ProofArtifact,
  type StartSessionRequest,
  type StartSessionResponse,
  type VerifyClaimResult,
} from '../types'

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
  return configured && configured.length > 0 ? configured : getDefaultBrokerBaseUrl()
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
  if (session && typeof session === 'object' && typeof (session as { sessionId?: string }).sessionId === 'string') {
    return (session as { sessionId: string }).sessionId
  }

  const attempt = record.attempt
  if (attempt && typeof attempt === 'object' && typeof (attempt as { sessionId?: string }).sessionId === 'string') {
    return (attempt as { sessionId: string }).sessionId
  }

  return null
}

async function requestJson<T>(path: string, init: BrokerRequestInit = {}): Promise<T> {
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toParaProvider(status: ProofBrokerParaProviderStatus): ParaProviderStatus {
  return {
    providerName: status.displayName,
    availability: status.availability === 'online' ? 'Online' : 'Degraded',
    lastSync: status.lastSyncAt,
    policyRecord: status.policyRecord,
    compatibilityRecord: status.compatibilityRecord,
    supportedClaims: status.supportedClaims,
    detail: status.notes,
  }
}

function mapClaimTypesToSignals(claims: ProofBrokerClaimSpec[]) {
  return claims.map((claim) => proofBrokerClaimLabel(claim.type).toLowerCase())
}

function mapGrantStatus(status: ProofBrokerGrant['status']): AppGrant['status'] {
  if (status === 'approved') return 'Active'
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Pending approval'
}

function mapGrantState(status: ProofBrokerGrant['status']): AppGrant['state'] {
  if (status === 'approved') return 'Live'
  if (status === 'revoked' || status === 'expired') return 'Paused'
  return 'Needs review'
}

function mapRequestStatus(status: ProofBrokerClaimRequest['status']): ClaimRequest['status'] {
  if (status === 'approved') return 'Approved'
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Pending'
}

function mapProofStatus(status: ProofBrokerProofArtifact['status']): ProofArtifact['status'] {
  if (status === 'active') return 'Active'
  if (status === 'revoked') return 'Revoked'
  return 'Expired'
}

function mapProviderTrustLevel(status: ProofBrokerParaProviderStatus): IdentitySession['providers'][number]['status'] {
  if (status.availability !== 'online') {
    return 'Degraded'
  }

  return status.compatibility === 'ready' ? 'Core' : 'Scoped'
}

function mapCurrentSession(session: ProofBrokerSession): IdentitySession {
  const paraProvider = toParaProvider(session.paraStatus)
  const providers = buildSignalProviders().map((provider) =>
    provider.id === 'para-verifier'
      ? {
          ...provider,
          status: mapProviderTrustLevel(session.paraStatus),
          summary: session.paraStatus.notes,
          lastSync: session.paraStatus.lastSyncAt,
        }
      : provider
  )

  return {
    brokerMode: session.brokerMode,
    did: session.did,
    handle: session.handle,
    displayName: session.displayName,
    authorizationServer: session.authorizationServer,
    pdsSafety: session.pdsSafety,
    paraProvider,
    claimCatalog: buildClaimCatalog(),
    consentPolicy: buildConsentPolicy(),
    proofLifecycle: buildProofLifecycleCopy(),
    pdsSafetyPolicy: buildPdsSafetyPolicy(),
    personas: buildPersonas(session.handle),
    pendingRequests: session.claimRequests
      .filter((request) => request.status === 'pending')
      .map((request) => ({
        id: request.id,
        appId: request.appId,
        appName: request.appName,
        appKind: request.appKind,
        surface: request.surface,
        requestedClaims: request.requestedClaims.map((claim) => claim.type),
        proofMode: 'proof-only',
        status: mapRequestStatus(request.status),
        audience: request.appName,
        expiryPreference: request.expiresAt ?? 'No expiry',
        requestedAt: request.requestedAt,
        reason: request.reason,
        verifier: request.requestedClaims.some((claim) => claim.type.startsWith('is_') || claim.type.startsWith('has_para'))
          ? 'PARA verifier'
          : 'm8 broker',
        expiresAt: request.expiresAt ?? undefined,
      })),
    grants: session.grants.map((grant) => ({
      id: grant.id,
      appId: grant.appId,
      appName: grant.appName,
      appKind: grant.appKind,
      surface: grant.surface,
      signals: mapClaimTypesToSignals(grant.requestedClaims),
      requestedClaims: grant.requestedClaims.map((claim) => claim.type),
      shareMode: 'proof-only',
      proofMode: 'proof-only',
      state: mapGrantState(grant.status),
      status: mapGrantStatus(grant.status),
      grantedAt: grant.issuedAt ?? grant.requestedAt,
      lastUsed: grant.lastUsedAt ?? 'Not yet used',
      expiresAt: grant.expiresAt ?? 'No expiry',
      audience: grant.appName,
      reason: grant.reason,
      verifier: grant.issuerId === 'para.identity' ? 'PARA verifier' : 'm8 broker',
      issuerRecord: 'com.para.identity',
      compatibilityRecord: 'app.bsky.graph.verification',
      proofArtifactIds: grant.proofArtifactIds,
    })),
    proofArtifacts: session.proofs.map((proof) => ({
      id: proof.id,
      claimType: proof.claimType,
      label: proof.claimType,
      issuer: proof.issuerId,
      verifier: proof.verifierId,
      audienceAppId: proof.audienceAppId,
      proofRef: proof.reference,
      summary: proof.statement,
      issuedAt: proof.issuedAt,
      expiresAt: proof.expiresAt ?? 'No expiry',
      status: mapProofStatus(proof.status),
    })),
    consentLedger: session.claimRequests.length >= 0
      ? []
      : [],
    providers,
    integrations: buildIntegrations(),
    safetyActions: buildSafetyActions(),
    surfaceTemplates: buildSurfaceTemplates(),
    commands: buildCommandDeck(),
  }
}

function attachLedger(session: IdentitySession, payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return session
  }

  const record = payload as Record<string, unknown>
  const ledger = record.ledger
  if (!Array.isArray(ledger)) {
    return session
  }

  return {
    ...session,
    consentLedger: ledger as IdentitySession['consentLedger'],
  }
}

function cacheSession(session: IdentitySession | null) {
  cachedSession = session ? clone(session) : null
}

export async function postSessionStart(
  input: StartSessionRequest
): Promise<StartSessionResponse> {
  const response = await requestJson<ProofBrokerSessionStartResponse>('/session/start', {
    method: 'POST',
    body: JSON.stringify(input),
    token: null,
  })

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
  const response = await requestJson<ProofBrokerSession | { session: ProofBrokerSession; ledger?: IdentitySession['consentLedger'] }>('/session/current')
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

function toContractGrantRequest(input: GrantRequestInput) {
  return {
    appId: input.appId,
    appName: input.appName,
    appKind: input.appKind as ProofBrokerGrantRequestInput['appKind'],
    surface: input.surface,
    requestedClaims: input.requestedClaims.map((claim) => ({
      type: claim as ProofBrokerClaimSpec['type'],
      disclosure: 'proof-only' as const,
    })),
    proofMode: 'proof-only' as const,
    reason: input.reason,
    expiresAt: input.expiryPreference,
  }
}

function extractPendingRequest(payload: unknown): ClaimRequest {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Broker response missing claim request')
  }

  const record = payload as Record<string, unknown>
  const request = record.request as ProofBrokerClaimRequest | undefined
  if (!request) {
    throw new Error('Broker response missing claim request')
  }

  return {
    id: request.id,
    appId: request.appId,
    appName: request.appName,
    appKind: request.appKind,
    surface: request.surface,
    requestedClaims: request.requestedClaims.map((claim) => claim.type),
    proofMode: 'proof-only',
    status: mapRequestStatus(request.status),
    audience: request.appName,
    expiryPreference: request.expiresAt ?? 'No expiry',
    requestedAt: request.requestedAt,
    reason: request.reason,
    verifier: 'PARA verifier',
    expiresAt: request.expiresAt ?? undefined,
  }
}

function extractGrant(payload: unknown): AppGrant {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Broker response missing grant')
  }

  const record = payload as Record<string, unknown>
  const grant = record.grant as ProofBrokerGrant | undefined
  if (!grant) {
    throw new Error('Broker response missing grant')
  }

  return {
    id: grant.id,
    appId: grant.appId,
    appName: grant.appName,
    appKind: grant.appKind,
    surface: grant.surface,
    signals: mapClaimTypesToSignals(grant.requestedClaims),
    requestedClaims: grant.requestedClaims.map((claim) => claim.type),
    shareMode: 'proof-only',
    proofMode: 'proof-only',
    state: mapGrantState(grant.status),
    status: mapGrantStatus(grant.status),
    grantedAt: grant.issuedAt ?? grant.requestedAt,
    lastUsed: grant.lastUsedAt ?? 'Not yet used',
    expiresAt: grant.expiresAt ?? 'No expiry',
    audience: grant.appName,
    reason: grant.reason,
    verifier: grant.issuerId === 'para.identity' ? 'PARA verifier' : 'm8 broker',
    issuerRecord: 'com.para.identity',
    compatibilityRecord: 'app.bsky.graph.verification',
    proofArtifactIds: grant.proofArtifactIds,
  }
}

export async function postGrantRequest(input: GrantRequestInput): Promise<ClaimRequest> {
  const response = await requestJson<ProofBrokerClaimRequest | { request: ProofBrokerClaimRequest; session?: ProofBrokerSession }>('/grants/request', {
    method: 'POST',
    body: JSON.stringify(toContractGrantRequest(input)),
  })

  if ('session' in response && response.session) {
    cacheSession(mapCurrentSession(response.session))
  }

  return extractPendingRequest('request' in response ? response : { request: response })
}

export async function postGrantApprove(id: string): Promise<AppGrant> {
  const response = await requestJson<{ session: ProofBrokerSession; grant: ProofBrokerGrant }>(`/grants/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ grantId: id }),
  })

  cacheSession(mapCurrentSession(response.session))
  return extractGrant(response)
}

export async function postGrantRevoke(id: string): Promise<AppGrant> {
  const response = await requestJson<{ session: ProofBrokerSession; grant: ProofBrokerGrant }>(`/grants/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ grantId: id }),
  })

  cacheSession(mapCurrentSession(response.session))
  return extractGrant(response)
}

export async function postClaimVerify(id: string): Promise<VerifyClaimResult[]> {
  const response = await requestJson<{ proofs: VerifyClaimResult[] }>('/claims/verify', {
    method: 'POST',
    body: JSON.stringify({ requestId: id }),
  })

  return response.proofs
}

export async function getParaProviderStatus(): Promise<ParaProviderStatus> {
  const response = await requestJson<ProofBrokerParaProviderStatus | { providerStatus?: ProofBrokerParaProviderStatus; paraProvider?: ProofBrokerParaProviderStatus }>('/providers/para/status')

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
}
