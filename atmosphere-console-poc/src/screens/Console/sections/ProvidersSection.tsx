import { View, Text, StyleSheet } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { MiniStat, CoreRow, ListRow, EmptyState } from '../../../components/m8/ConsolePrimitives'
import type { IdentitySession, Integration, SignalProvider } from '../../../types'
import { tokens } from '../../../theme'

export function ProvidersSection({
  session,
  visibleApps,
  visibleProviders,
  theme,
}: {
  session: IdentitySession
  visibleApps: Integration[]
  visibleProviders: SignalProvider[]
  theme: typeof tokens
}) {
  return (
    <View style={styles.stack}>
      <View style={cardStyle('filled')}>
        <Text style={styles.summaryEyebrow}>PARA verifier</Text>
        <Text style={styles.summaryTitle}>{session.paraProvider.availability}</Text>
        <Text style={styles.summaryBody}>{session.paraProvider.detail}</Text>
        <View style={styles.coreList}>
          <CoreRow label="Policy" value={session.paraProvider.policyRecord} />
          <CoreRow label="Last sync" value={session.paraProvider.lastSync} />
        </View>
        <View style={styles.tagRow}>
          {session.paraProvider.supportedClaims.map((claim) => (
            <View key={claim} style={pillStyle('accent')}>
              <Text style={pillTextStyle('accent')}>{claimLabel(claim)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Connected apps</Text>
        {visibleApps.length > 0 ? (
          visibleApps.map((app) => (
            <ListRow key={app.id} title={app.name} detail={`${app.status} · ${app.summary}`} meta={app.cta} />
          ))
        ) : (
          <EmptyState icon="📱" title="No apps yet" detail="Apps will appear here when they connect to your identity." />
        )}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Providers</Text>
        {visibleProviders.map((provider) => (
          <View key={provider.id} style={rowStyle('default')}>
            <View style={rowStyles.text}>
              <Text style={rowStyles.title}>{provider.name}</Text>
              <Text style={rowStyles.detail}>{provider.kind} · {provider.routing}</Text>
            </View>
            <View style={pillStyle(provider.status === 'Core' ? 'success' : 'muted')}>
              <Text style={pillTextStyle(provider.status === 'Core' ? 'success' : 'muted')}>
                {provider.status}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function claimLabel(claim: string) {
  const labels: Record<string, string> = {
    is_verified_public_figure: 'Verified public figure',
    is_civic_eligible: 'Civic eligible',
    has_para_verification: 'PARA verified',
    has_party_affiliation_match: 'Party match',
    is_age_eligible: 'Age eligible',
    has_backup_coverage: 'Backup',
  }
  return labels[claim] ?? claim
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
  coreList: {
    gap: 8,
    marginTop: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
})
