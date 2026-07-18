import {
  clearPersistedSession,
  getCachedSession,
  getCurrentSession,
  restoreCurrentSession,
  createNativeSession,
  restoreNativeSession,
  persistSessionSnapshot,
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

export async function requestGrant(input: GrantRequestInput) {
  return postGrantRequest(input)
}

export async function approveGrant(id: string) {
  return postGrantApprove(id)
}

export async function revokeGrant(id: string) {
  return postGrantRevoke(id)
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

/**
 * Re-reads the session from its source of truth: the broker for
 * broker-backed sessions, the persisted native snapshot for local ones.
 * Falls back to the current session if the source is unreachable.
 */
export async function refreshIdentitySession(current: IdentitySession): Promise<IdentitySession> {
  const local = await restoreNativeSession()
  if (local) {
    return local
  }

  try {
    return await getCurrentSession()
  } catch {
    return current
  }
}

export function clearIdentitySession() {
  void clearPersistedSession()
}
