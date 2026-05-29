import { startTransition, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  clearIdentitySession,
  approveGrant,
  beginIdentitySession,
  prepareIdentitySession,
  requestGrant,
  revokeGrant,
  restoreIdentitySession,
  createNativeIdentity,
  persistIdentitySession,
} from '../services/identityBroker'
import {
  type BootstrapStatus,
  type BrokerAttempt,
  type GrantRequestInput,
  type IdentitySession,
  type IneVerificationRecord,
  type PolicyChangeRequest,
  type SocialProvider,
} from '../types'
import { buildPublicPersona } from '../poc-data'

export function useSessionBootstrap() {
  const [session, setSession] = useState<IdentitySession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<BrokerAttempt | null>(null)
  const [status, setStatus] = useState<BootstrapStatus>('idle')

  useEffect(() => {
    let mounted = true

    void restoreIdentitySession()
      .then((restored) => {
        if (!mounted || !restored) return
        startTransition(() => {
          setSession(restored)
        })
      })
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : 'Unable to restore session'
        if (mounted) {
          setError(message)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  async function refreshSession(nextAttempt?: BrokerAttempt | null) {
    const fallbackAttempt = nextAttempt ?? attempt ?? {
      did: '',
      handle: '',
      authorizationServer: '',
      phaseLabel: '',
      provider: 'bsky' as const,
    }
    const nextSession = await beginIdentitySession(fallbackAttempt)
    const hydratedSession = preservePublicIdentityState(nextSession, session)

    startTransition(() => {
      setSession(hydratedSession)
    })
  }

  async function signIn(input: string) {
    try {
      setError(null)
      setAttempt(null)
      setStatus('resolving')

      const nextAttempt = await prepareIdentitySession(input)
      setAttempt(nextAttempt)
      setStatus('hydrating')

      await refreshSession(nextAttempt)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to start session'
      setError(message)
    } finally {
      setStatus('idle')
    }
  }

  async function createLocalIdentity(handle: string) {
    try {
      setError(null)
      setAttempt(null)
      setStatus('hydrating')

      const nextSession = await createNativeIdentity(handle)
      startTransition(() => {
        setSession(nextSession)
      })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to create identity'
      setError(message)
    } finally {
      setStatus('idle')
    }
  }

  async function createGrantRequest(input: GrantRequestInput) {
    try {
      setError(null)
      await requestGrant(input)
      await refreshSession()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to request grant'
      setError(message)
    }
  }

  async function approveGrantRequest(id: string) {
    try {
      setError(null)
      await approveGrant(id)
      await refreshSession()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to approve grant'
      setError(message)
    }
  }

  async function revokeExistingGrant(id: string) {
    try {
      setError(null)
      await revokeGrant(id)
      await refreshSession()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to revoke grant'
      setError(message)
    }
  }

  async function updateSession(nextSession: IdentitySession) {
    const persisted = await persistIdentitySession(nextSession)
    startTransition(() => {
      setSession(persisted)
    })
  }

  async function saveIneVerification(record: IneVerificationRecord) {
    if (!session) return
    await updateSession({
      ...session,
      ineVerification: record,
      renameStatus: session.renameStatus === 'used' ? 'used' : 'available',
    })
  }

  async function updateDisplayName(displayName: string) {
    if (!session) return
    const cleanName = displayName.trim()
    if (!cleanName) return

    await updateSession({
      ...session,
      displayName: cleanName,
      verifiedDisplayName: cleanName,
      renameStatus: 'used',
      personas: session.personas.map((persona, index) =>
        index === 0
          ? {
              ...persona,
              name: cleanName,
              oneLine: 'Verified civic identity for PARA-compatible apps',
            }
          : persona
      ),
    })
  }

  async function linkPublicSocial(provider: SocialProvider, handle: string) {
    if (!session) return
    const cleanHandle = normalizeSocialHandle(handle)
    if (!cleanHandle) return

    const activeLinks = (session.publicLinks ?? []).filter((link) => link.status === 'linked')
    const existingPublicPersona = session.publicPersonaId
      ? session.personas.find((persona) => persona.id === session.publicPersonaId)
      : session.personas.find((persona) => persona.kind === 'public')
    const personaId = existingPublicPersona?.id ?? 'public-primary'
    const nextLinks = [
      ...(session.publicLinks ?? []).filter((link) => !(link.provider === provider && link.status === 'linked')),
      {
        id: `${provider}-${Date.now()}`,
        provider,
        handle: cleanHandle,
        personaId,
        linkedAt: 'Today',
        status: 'linked' as const,
      },
    ]
    const nextActiveProviders = Array.from(
      new Set([...activeLinks.map((link) => link.provider), provider])
    )
    const nextPublicPersona = {
      ...buildPublicPersona(existingPublicPersona?.name ?? cleanHandle, nextActiveProviders),
      id: personaId,
      name: existingPublicPersona?.name ?? cleanHandle,
      handle: existingPublicPersona?.handle ?? `@${cleanHandle}`,
    }
    const nextPersonas = existingPublicPersona
      ? session.personas.map((persona) => persona.id === personaId ? nextPublicPersona : persona)
      : [...session.personas, nextPublicPersona]

    await updateSession({
      ...session,
      personas: nextPersonas,
      publicLinks: nextLinks,
      publicPersonaId: personaId,
    })
  }

  async function createPublicPersona(displayName: string) {
    if (!session) return
    const cleanName = normalizeSocialHandle(displayName) || 'public-card'
    const existingPublicPersona = session.publicPersonaId
      ? session.personas.find((persona) => persona.id === session.publicPersonaId)
      : session.personas.find((persona) => persona.kind === 'public')
    if (existingPublicPersona) return

    const publicPersona = buildPublicPersona(cleanName, [])
    await updateSession({
      ...session,
      personas: [...session.personas, publicPersona],
      publicPersonaId: publicPersona.id,
      publicLinks: session.publicLinks ?? [],
    })
  }

  async function unlinkPublicSocial(id: string) {
    if (!session) return
    const nextLinks = (session.publicLinks ?? []).map((link) =>
      link.id === id ? { ...link, status: 'revoked' as const } : link
    )
    const activeLinks = nextLinks.filter((link) => link.status === 'linked')
    const publicPersonaId = session.publicPersonaId ?? session.personas.find((persona) => persona.kind === 'public')?.id
    const publicPersona = publicPersonaId
      ? session.personas.find((persona) => persona.id === publicPersonaId)
      : undefined
    const shouldHidePublicPersona = Boolean(publicPersona?.createdBy === 'social-link' && activeLinks.length === 0)

    await updateSession({
      ...session,
      publicLinks: nextLinks,
      publicPersonaId: shouldHidePublicPersona ? undefined : publicPersonaId,
      personas: shouldHidePublicPersona
        ? session.personas.filter((persona) => persona.id !== publicPersonaId)
        : session.personas.map((persona) =>
            persona.id === publicPersonaId
              ? {
                  ...buildPublicPersona(persona.name, activeLinks.map((link) => link.provider)),
                  id: persona.id,
                  handle: persona.handle,
                  createdBy: persona.createdBy,
                }
              : persona
          ),
    })
  }

  async function approvePolicyChange(requestId: string, adminDid: string) {
    if (!session) return
    await updateSession({
      ...session,
      policyChangeRequests: updatePolicyChange(session.policyChangeRequests ?? [], requestId, (request) => {
        if (request.status === 'blocked' || request.status === 'applied') return request
        const approvals = request.approvals.map((approval) =>
          approval.adminDid === adminDid
            ? { ...approval, status: 'approved' as const, approvedAt: 'Today' }
            : approval
        )
        const approved = approvals.every((approval) => approval.status === 'approved')
        return {
          ...request,
          approvals,
          status: approved ? 'approved' : 'awaiting_admins',
        }
      }),
    })
  }

  async function rejectPolicyChange(requestId: string, adminDid: string) {
    if (!session) return
    await updateSession({
      ...session,
      policyChangeRequests: updatePolicyChange(session.policyChangeRequests ?? [], requestId, (request) => {
        if (request.status === 'applied') return request
        return {
          ...request,
          approvals: request.approvals.map((approval) =>
            approval.adminDid === adminDid
              ? { ...approval, status: 'rejected' as const }
              : approval
          ),
          status: 'blocked',
        }
      }),
    })
  }

  async function applyPolicyChange(requestId: string) {
    if (!session) return
    await updateSession({
      ...session,
      policyChangeRequests: updatePolicyChange(session.policyChangeRequests ?? [], requestId, (request) => {
        const approved = request.approvals.length === 3 && request.approvals.every((approval) => approval.status === 'approved')
        if (!approved || request.status === 'blocked') return request
        return {
          ...request,
          status: 'applied',
          appliedAt: 'Today',
        }
      }),
    })
  }

  async function signOut() {
    clearIdentitySession()
    setSession(null)
    setError(null)
    setAttempt(null)
    setStatus('idle')

    // Clear user preferences so they don't leak across identities
    await AsyncStorage.removeItem('@m8/dark-mode')
    await AsyncStorage.removeItem('@m8/biometric-enabled')
    await AsyncStorage.removeItem('@m8/last-background')

    const allKeys = await AsyncStorage.getAllKeys()
    const aiCacheKeys = allKeys.filter((k) => k.startsWith('@ai_cache_'))
    for (const key of aiCacheKeys) {
      await AsyncStorage.removeItem(key)
    }
  }

  return {
    attempt,
    applyPolicyChange,
    approveGrantRequest,
    approvePolicyChange,
    createGrantRequest,
    createLocalIdentity,
    error,
    isLoading: status !== 'idle',
    saveIneVerification,
    createPublicPersona,
    linkPublicSocial,
    revokeExistingGrant,
    rejectPolicyChange,
    session,
    signIn,
    signOut,
    status,
    unlinkPublicSocial,
    updateDisplayName,
  }
}

function normalizeSocialHandle(handle: string) {
  return handle.trim().replace(/^@/, '').replace(/\s+/g, '-').toLowerCase()
}

function updatePolicyChange(
  requests: PolicyChangeRequest[],
  requestId: string,
  update: (request: PolicyChangeRequest) => PolicyChangeRequest
) {
  return requests.map((request) => request.id === requestId ? update(request) : request)
}

function preservePublicIdentityState(nextSession: IdentitySession, currentSession: IdentitySession | null) {
  if (!currentSession) return nextSession
  const currentPublicPersona = currentSession.publicPersonaId
    ? currentSession.personas.find((persona) => persona.id === currentSession.publicPersonaId)
    : currentSession.personas.find((persona) => persona.kind === 'public')
  const currentPublicLinks = currentSession.publicLinks ?? []
  const currentPolicyChangeRequests = currentSession.policyChangeRequests ?? []
  const hasGovernanceState = currentPolicyChangeRequests.length > 0 || (currentSession.communityAdmins ?? []).length > 0
  if (!currentPublicPersona && currentPublicLinks.length === 0 && !hasGovernanceState) {
    return nextSession
  }

  const nextHasPublicPersona = nextSession.personas.some((persona) => persona.kind === 'public')
  return {
    ...nextSession,
    publicLinks: nextSession.publicLinks && nextSession.publicLinks.length > 0
      ? nextSession.publicLinks
      : currentPublicLinks,
    publicPersonaId: nextSession.publicPersonaId ?? currentSession.publicPersonaId,
    communityAdmins: nextSession.communityAdmins && nextSession.communityAdmins.length > 0
      ? nextSession.communityAdmins
      : currentSession.communityAdmins,
    policyChangeRequests: nextSession.policyChangeRequests && nextSession.policyChangeRequests.length > 0
      ? mergePolicyChangeRequests(nextSession.policyChangeRequests, currentPolicyChangeRequests)
      : currentPolicyChangeRequests,
    personas: nextHasPublicPersona || !currentPublicPersona
      ? nextSession.personas
      : [...nextSession.personas, currentPublicPersona],
  }
}

function mergePolicyChangeRequests(nextRequests: PolicyChangeRequest[], currentRequests: PolicyChangeRequest[]) {
  return nextRequests.map((nextRequest) => {
    return currentRequests.find((currentRequest) => currentRequest.id === nextRequest.id) ?? nextRequest
  })
}
