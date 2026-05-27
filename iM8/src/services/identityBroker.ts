import {
  clearPersistedSession,
  getCachedSession,
  getCurrentSession,
  getParaProviderStatus,
  restoreCurrentSession,
  createNativeSession,
  restoreNativeSession,
  persistSessionSnapshot,
  postClaimVerify,
  postGrantApprove,
  postGrantRequest,
  postGrantRevoke,
  postSessionStart,
} from './brokerApi'
import {
  type BrokerAttempt,
  type GrantRequestInput,
  type IdentityProvider,
  type IdentitySession,
  type ParaProviderStatus,
  type StartSessionResponse,
  type VerifyClaimResult,
} from '../types'

export async function prepareIdentitySession(input: string, provider: IdentityProvider = 'bsky'): Promise<BrokerAttempt> {
  const response = await postSessionStart({ identifier: input, provider })
  return response.identity
}

export async function beginIdentitySession(_attempt: BrokerAttempt): Promise<IdentitySession> {
  const cached = getCachedSession()
  if (cached) {
    return cached
  }

  return getCurrentSession()
}

export async function startIdentitySession(input: string, provider: IdentityProvider = 'bsky'): Promise<StartSessionResponse> {
  return postSessionStart({ identifier: input, provider })
}

export async function requestGrant(input: GrantRequestInput) {
  return postGrantRequest(input)
}

export async function approveGrant(id: string) {
  return postGrantApprove(id)
}

export async function revokeGrant(id: string) {
  return postGrantRevoke(id)
}

export async function verifyClaimRequest(id: string): Promise<VerifyClaimResult[]> {
  return postClaimVerify(id)
}

export async function readParaProviderStatus(): Promise<ParaProviderStatus> {
  return getParaProviderStatus()
}

export async function createNativeIdentity(handle: string): Promise<IdentitySession> {
  return createNativeSession(handle)
}

export async function persistIdentitySession(session: IdentitySession): Promise<IdentitySession> {
  return persistSessionSnapshot(session)
}

export async function restoreIdentitySession(): Promise<IdentitySession | null> {
  const cached = getCachedSession()
  if (cached) {
    return cached
  }

  const local = await restoreNativeSession()
  if (local) {
    return local
  }

  return restoreCurrentSession()
}

export function clearIdentitySession() {
  void clearPersistedSession()
}
