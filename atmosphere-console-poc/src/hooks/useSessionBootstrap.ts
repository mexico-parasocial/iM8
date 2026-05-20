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
} from '../types'

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

    startTransition(() => {
      setSession(nextSession)
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
              oneLine: 'Verified public identity for PARA-compatible apps',
            }
          : persona
      ),
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
    approveGrantRequest,
    createGrantRequest,
    createLocalIdentity,
    error,
    isLoading: status !== 'idle',
    saveIneVerification,
    revokeExistingGrant,
    session,
    signIn,
    signOut,
    status,
    updateDisplayName,
  }
}
