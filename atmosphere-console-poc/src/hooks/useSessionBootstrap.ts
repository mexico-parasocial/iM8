import { startTransition, useEffect, useState } from 'react'
import {
  clearIdentitySession,
  approveGrant,
  beginIdentitySession,
  prepareIdentitySession,
  requestGrant,
  revokeGrant,
  restoreIdentitySession,
} from '../services/identityBroker'
import {
  type BootstrapStatus,
  type BrokerAttempt,
  type GrantRequestInput,
  type IdentitySession,
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

  function signOut() {
    clearIdentitySession()
    setSession(null)
    setError(null)
    setAttempt(null)
    setStatus('idle')
  }

  return {
    attempt,
    approveGrantRequest,
    createGrantRequest,
    error,
    isLoading: status !== 'idle',
    revokeExistingGrant,
    session,
    signIn,
    signOut,
    status,
  }
}
