import { useMemo, useState, useCallback } from 'react'
import type { IconName } from '../components/m8/Icon'
import type { IdentitySession } from '../types'

export type NotificationSeverity = 'danger' | 'warning' | 'info' | 'success'

export type NotificationItem = {
  id: string
  severity: NotificationSeverity
  icon: IconName
  title: string
  body?: string
  time: string
  action?: { label: string; onPress: () => void }
  source: 'system' | 'user'
}

export function useNotificationEngine(
  session: IdentitySession,
  onReviewGrants: () => void
) {
  const [userNotes, setUserNotes] = useState<NotificationItem[]>([])

  // Derive system warnings from live session data
  const systemWarnings = useMemo<NotificationItem[]>(() => {
    const warnings: NotificationItem[] = []

    const revokedCount = session.grants.filter((g) => g.status === 'Revoked').length
    if (revokedCount > 0) {
      warnings.push({
        id: 'sys:revoked-grants',
        severity: 'danger',
        icon: 'circleX',
        title: `${revokedCount} revoked grant${revokedCount > 1 ? 's' : ''}`,
        body: 'Revoked grants remain visible for audit, but linked proofs are marked inactive.',
        time: 'Now',
        action: { label: 'Review', onPress: onReviewGrants },
        source: 'system',
      })
    }

    const expiredCount = session.proofArtifacts.filter((a) => a.status === 'Expired').length
    if (expiredCount > 0) {
      warnings.push({
        id: 'sys:expired-proofs',
        severity: 'warning',
        icon: 'warning',
        title: `${expiredCount} expired proof${expiredCount > 1 ? 's' : ''}`,
        body: 'Expired proofs stay in history, but they are no longer treated as active access.',
        time: 'Now',
        action: { label: 'Review', onPress: onReviewGrants },
        source: 'system',
      })
    }

    if (session.paraProvider.availability === 'Degraded') {
      warnings.push({
        id: 'sys:para-degraded',
        severity: 'warning',
        icon: 'warning',
        title: 'PARA is degraded',
        body: 'Verification still shows up here, but claim refreshes may need manual review until PARA is healthy again.',
        time: 'Now',
        source: 'system',
      })
    }

    const pendingCount = session.pendingRequests.length
    if (pendingCount > 0) {
      warnings.push({
        id: 'sys:pending-requests',
        severity: 'info',
        icon: 'inbox',
        title: `${pendingCount} pending request${pendingCount > 1 ? 's' : ''}`,
        body: 'Apps are waiting for proof approvals.',
        time: 'Now',
        action: { label: 'Review', onPress: onReviewGrants },
        source: 'system',
      })
    }

    return warnings
  }, [session, onReviewGrants])

  // Merge system warnings (first) + user notifications
  const allNotifications = useMemo<NotificationItem[]>(() => {
    return [...systemWarnings, ...userNotes]
  }, [systemWarnings, userNotes])

  // Badge count: only danger + warning + info (not success)
  const badgeCount = useMemo(() => {
    return allNotifications.filter((n) => n.severity !== 'success').length
  }, [allNotifications])

  const hasDanger = useMemo(() => allNotifications.some((n) => n.severity === 'danger'), [allNotifications])

  const addNotification = useCallback(
    (icon: IconName, title: string, body?: string) => {
      setUserNotes((prev) =>
        [
          {
            id: `usr:${Date.now()}`,
            severity: 'info' as const,
            icon,
            title,
            body,
            time: 'Just now',
            source: 'user' as const,
          },
          ...prev,
        ].slice(0, 50)
      )
    },
    []
  )

  const dismissNotification = useCallback((id: string) => {
    setUserNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return {
    notifications: allNotifications,
    badgeCount,
    hasDanger,
    addNotification,
    dismissNotification,
  }
}
