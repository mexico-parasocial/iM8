import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  ClaimChips,
  EmptyCard,
  NotificationCard,
  SectionHeading,
  SectionHero,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { tokens } from '../../../theme'
import type { AppGrant, ClaimRequest } from '../../../types'
import type { NotificationItem } from '../../../hooks/useNotifications'
import { consoleStyles } from '../styles'

export function RequestsSection({
  grants,
  notifications,
  onApprove,
  onDismissNotification,
  onRevoke,
  pendingRequests,
}: {
  grants: AppGrant[]
  notifications: NotificationItem[]
  onApprove: (id: string) => Promise<void>
  onDismissNotification: (id: string) => void
  onRevoke: (id: string) => Promise<void>
  pendingRequests: ClaimRequest[]
}) {
  return (
    <View style={consoleStyles.stack}>
      <SectionHero
        eyebrow="Requests"
        title={pendingRequests.length > 0 ? 'Apps are waiting for proof decisions.' : 'No proof requests need action.'}
        body="Requests, warnings, and grant receipts live here now instead of behind a tiny bell."
        icon="inbox"
      />

      {notifications.length > 0 ? (
        <View style={consoleStyles.listBlock}>
          <SectionHeading title="Inbox" detail="System notices and user notes." />
          {notifications.map((note) => (
            <NotificationCard
              key={note.id}
              notification={note}
              onDismissNotification={onDismissNotification}
            />
          ))}
        </View>
      ) : null}

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Pending approvals" detail="Apps receive proofs only after you approve." />
        {pendingRequests.length > 0 ? (
          pendingRequests.map((request) => (
            <RequestCard key={request.id} request={request} onApprove={onApprove} />
          ))
        ) : (
          <EmptyCard icon="check" title="Nothing pending" body="New app requests will appear here with plain-language proof details." />
        )}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Grant receipts" detail="Every active or revoked permission stays visible." />
        {grants.map((grant) => (
          <GrantCard key={grant.id} grant={grant} onRevoke={onRevoke} />
        ))}
      </View>
    </View>
  )
}

function RequestCard({
  onApprove,
  request,
}: {
  onApprove: (id: string) => Promise<void>
  request: ClaimRequest
}) {
  const [busy, setBusy] = useState(false)
  return (
    <View style={consoleStyles.receiptCard}>
      <View style={consoleStyles.rowBetween}>
        <Text style={consoleStyles.cardTitle}>{request.appName}</Text>
        <StatusPill label={request.status} tone="warning" />
      </View>
      <Text style={consoleStyles.cardBodyText}>{request.reason}</Text>
      <ClaimChips claims={request.requestedClaims} />
      <Pressable
        onPress={async () => {
          setBusy(true)
          try {
            await onApprove(request.id)
          } finally {
            setBusy(false)
          }
        }}
        disabled={busy}
        style={[buttonStyle('primary'), consoleStyles.fullButton, busy && consoleStyles.disabled]}
      >
        {busy ? (
          <ActivityIndicator color={tokens.onAccent} />
        ) : (
          <Text style={buttonTextStyle('primary')}>Approve proof request</Text>
        )}
      </Pressable>
    </View>
  )
}

function GrantCard({
  grant,
  onRevoke,
}: {
  grant: AppGrant
  onRevoke: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const active = grant.status === 'Active'
  return (
    <View style={consoleStyles.receiptCard}>
      <View style={consoleStyles.rowBetween}>
        <Text style={consoleStyles.cardTitle}>{grant.appName}</Text>
        <StatusPill label={grant.status} tone={active ? 'success' : 'neutral'} />
      </View>
      <Text style={consoleStyles.cardBodyText}>{grant.reason}</Text>
      <ClaimChips claims={grant.requestedClaims} />
      {active ? (
        <Pressable
          onPress={async () => {
            setBusy(true)
            try {
              await onRevoke(grant.id)
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
          style={[buttonStyle('secondary'), consoleStyles.fullButton, busy && consoleStyles.disabled]}
        >
          <Text style={buttonTextStyle('secondary')}>{busy ? 'Revoking...' : 'Revoke grant'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({})
