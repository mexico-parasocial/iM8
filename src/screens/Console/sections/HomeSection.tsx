import { Pressable, StyleSheet, Text, View } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import {
  consoleStyles,
  Metric,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import type { Persona } from '../../../types'
import { tokens } from '../../../theme'

export function HomeSection({
  activePersona,
  onGoToIdentity,
  personaCount,
  pendingCount,
  activeGrantCount,
}: {
  activePersona: Persona | undefined
  onGoToIdentity: () => void
  personaCount: number
  pendingCount: number
  activeGrantCount: number
}) {
  return (
    <View style={consoleStyles.stack}>
      <View style={consoleStyles.heroCard}>
        <View style={consoleStyles.rowBetween}>
          <View style={styles.iconWrap}>
            <Icon name="person" size={18} color={tokens.accentSoft} />
          </View>
          <Text style={styles.meta}>{activePersona?.kind === 'public' ? 'Public' : 'Anonymous'}</Text>
        </View>
        <Text style={styles.heroTitle}>{activePersona?.name ?? 'No card selected'}</Text>
        <Text style={styles.heroBody}>
          {activePersona?.oneLine ?? 'Choose a card in Identity. The private root is not shown as a profile.'}
        </Text>
        <View style={consoleStyles.metricRow}>
          <Metric label="Cards" value={String(personaCount)} />
          <Metric label="Requests" value={String(pendingCount)} />
          <Metric label="Active grants" value={String(activeGrantCount)} />
        </View>
        <Pressable onPress={onGoToIdentity} style={styles.linkButton}>
          <Text style={styles.linkText}>Open identity</Text>
          <Icon name="chevronRight" size={14} color={tokens.accentSoft} />
        </Pressable>
      </View>

      {/*
        The two original guarantee cards, folded into one and moved to the
        bottom: they are the conceptual footnote of the dash, not its opening.
      */}
      <View style={cardStyle('accent')}>
        <View style={styles.guaranteeRow}>
          <Icon name="lock" size={16} color={tokens.accentSoft} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>Private civic root</Text>
            <Text style={styles.guaranteeBody}>
              Hidden authority for one vote, recovery, and proof issuance. Never a public profile.
            </Text>
          </View>
        </View>
        <View style={styles.guaranteeRow}>
          <Icon name="shieldCheck" size={16} color={tokens.accentSoft} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>One vote. Guaranteed.</Text>
            <Text style={styles.guaranteeBody}>
              However many cards you create, the root ensures one vote per policy.
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  heroTitle: {
    color: tokens.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  heroBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guaranteeTitle: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '800',
  },
  guaranteeBody: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accentTransparent,
  },
  meta: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
  },
  linkText: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '800',
  },
})
