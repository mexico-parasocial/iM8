import {
  proofBrokerClaimLabel,
  type ProofBrokerClaimRequest,
  type ProofBrokerClaimSpec,
  type ProofBrokerGrant,
  type ProofBrokerGrantRequestInput,
  type ProofBrokerParaProviderStatus,
  type ProofBrokerProofArtifact,
  type ProofBrokerSession,
} from '../../contracts/proofBroker'
import {
  buildPersonas,
  buildSignalProviders,
  buildIntegrations,
  buildSurfaceTemplates,
  buildCommandDeck,
} from '../../poc-data'
import {
  buildClaimCatalog,
  buildConsentPolicy,
  buildPdsSafetyPolicy,
  buildProofLifecycleCopy,
  buildSafetyActions,
} from '../trustPolicy'
import type {
  AppGrant,
  ClaimRequest,
  GrantRequestInput,
  IdentitySession,
  ParaProviderStatus,
  ProofArtifact,
  VerifyClaimResult,
} from '../../types'

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function toParaProvider(
  status: ProofBrokerParaProviderStatus
): ParaProviderStatus {
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

export function mapClaimTypesToSignals(claims: ProofBrokerClaimSpec[]) {
  return claims.map((claim) => proofBrokerClaimLabel(claim.type).toLowerCase())
}

export function mapGrantStatus(
  status: ProofBrokerGrant['status']
): AppGrant['status'] {
  if (status === 'approved') return 'Active'
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Pending approval'
}

export function mapGrantState(
  status: ProofBrokerGrant['status']
): AppGrant['state'] {
  if (status === 'approved') return 'Live'
  if (status === 'revoked' || status === 'expired') return 'Paused'
  return 'Needs review'
}

export function mapRequestStatus(
  status: ProofBrokerClaimRequest['status']
): ClaimRequest['status'] {
  if (status === 'approved') return 'Approved'
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Pending'
}

export function mapProofStatus(
  status: ProofBrokerProofArtifact['status']
): ProofArtifact['status'] {
  if (status === 'active') return 'Active'
  if (status === 'revoked') return 'Revoked'
  return 'Expired'
}

export function mapProviderTrustLevel(
  status: ProofBrokerParaProviderStatus
): IdentitySession['providers'][number]['status'] {
  if (status.availability !== 'online') {
    return 'Degraded'
  }
  return status.compatibility === 'ready' ? 'Core' : 'Scoped'
}

export function mapCurrentSession(
  session: ProofBrokerSession
): IdentitySession {
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
        verifier: request.requestedClaims.some(
          (claim) =>
            claim.type.startsWith('is_') || claim.type.startsWith('has_para')
        )
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
    consentLedger: session.claimRequests.length >= 0 ? [] : [],
    providers,
    integrations: buildIntegrations(),
    safetyActions: buildSafetyActions(),
    surfaceTemplates: buildSurfaceTemplates(),
    commands: buildCommandDeck(),
  }
}

export function attachLedger(
  session: IdentitySession,
  payload: unknown
): IdentitySession {
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

export function toContractGrantRequest(input: GrantRequestInput) {
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

export function extractPendingRequest(payload: unknown): ClaimRequest {
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

export function extractGrant(payload: unknown): AppGrant {
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
