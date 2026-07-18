import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { ClaimChips, consoleStyles, StatusPill } from '../../../components/m8/ConsolePrimitives'
import { tokens } from '../../../theme'
import type { AppGrant, ClaimRequest } from '../../../types'

export function RequestCard({
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

export function GrantCard({
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
