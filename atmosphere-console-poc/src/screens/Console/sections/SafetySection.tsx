import { View, Text, StyleSheet } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { MiniStat, CoreRow, EmptyState } from '../../../components/m8/ConsolePrimitives'
import type { IdentitySession, Persona, SafetyAction, ConsentLedgerEntry } from '../../../types'
import { tokens } from '../../../theme'

export function SafetySection({
  session,
  activePersona,
  theme,
}: {
  session: IdentitySession
  activePersona: Persona | undefined
  theme: typeof tokens
}) {
  return (
    <View style={styles.stack}>
      <View style={cardStyle('filled')}>
        <Text style={styles.summaryEyebrow}>PDS safety</Text>
        <Text style={styles.summaryTitle}>{session.pdsSafety.state}</Text>
        <Text style={styles.summaryBody}>
          {session.pdsSafety.detail} Source: {session.pdsSafety.source}. Last backup: {session.pdsSafety.lastBackup}.
        </Text>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Safety actions</Text>
        {session.safetyActions.map((action) => (
          <SafetyActionRow key={action.title} action={action} />
        ))}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Consent ledger</Text>
        {session.consentLedger.length > 0 ? (
          session.consentLedger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
        ) : (
          <EmptyState icon="shield" title="Ledger empty" detail="Your consent history will appear here." />
        )}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Privacy settings</Text>
        {activePersona?.signals.map((signal) => (
          <View key={signal.label} style={rowStyle('default')}>
            <View style={rowStyles.text}>
              <Text style={rowStyles.title}>{signal.label}</Text>
              <Text style={rowStyles.detail}>{signal.value}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={pillStyle(signal.visibility === 'Public' ? 'success' : signal.visibility === 'Private' ? 'danger' : 'warning')}>
                <Text style={pillTextStyle(signal.visibility === 'Public' ? 'success' : signal.visibility === 'Private' ? 'danger' : 'warning')}>
                  {signal.visibility}
                </Text>
              </View>
              <Text style={{ color: tokens.muted, fontSize: 11 }}>{signal.action}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function SafetyActionRow({ action }: { action: SafetyAction }) {
  return (
    <View style={rowStyle('default')}>
      <View style={rowStyles.text}>
        <Text style={rowStyles.title}>{action.title}</Text>
        <Text style={rowStyles.detail}>{action.detail}</Text>
      </View>
      <View style={pillStyle(action.urgency === 'Now' ? 'danger' : action.urgency === 'Soon' ? 'warning' : 'muted')}>
        <Text style={pillTextStyle(action.urgency === 'Now' ? 'danger' : action.urgency === 'Soon' ? 'warning' : 'muted')}>
          {action.urgency}
        </Text>
      </View>
    </View>
  )
}

function LedgerRow({ entry }: { entry: ConsentLedgerEntry }) {
  return (
    <View style={rowStyle('default')}>
      <View style={rowStyles.text}>
        <Text style={rowStyles.title}>{entry.subject}</Text>
        <Text style={rowStyles.detail}>{entry.detail}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={pillStyle(entry.action === 'Revoked' ? 'danger' : entry.action === 'Approved' ? 'success' : 'accent')}>
          <Text style={pillTextStyle(entry.action === 'Revoked' ? 'danger' : entry.action === 'Approved' ? 'success' : 'accent')}>
            {entry.action}
          </Text>
        </View>
        <Text style={{ color: tokens.muted, fontSize: 11 }}>{entry.timestamp}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    marginTop: 12,
  },
  listCard: {
    gap: 8,
  },
  listTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  summaryEyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  summaryTitle: {
    color: tokens.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  summaryBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
})
