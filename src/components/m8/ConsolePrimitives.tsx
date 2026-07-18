import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Icon, type IconName } from './Icon'
import { tokens } from '../../theme'
import type { NotificationItem } from '../../hooks/useNotifications'
import { CLAIM_LABELS } from '../../screens/Console/constants'

export function EmptyState({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
      <Icon name={icon} size={32} color={tokens.muted} />
      <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: tokens.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>{detail}</Text>
    </View>
  )
}

export function ListRow({ detail, meta, title }: { detail: string; meta: string; title: string }) {
  return (
    <View style={consoleStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: tokens.muted, fontSize: 12, marginTop: 2 }}>{detail}</Text>
      </View>
      <Text style={{ color: tokens.accentSoft, fontSize: 12, fontWeight: '600' }}>{meta}</Text>
    </View>
  )
}

export function CoreRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={consoleStyles.coreRow}>
      <Text style={{ color: tokens.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: tokens.text, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

export function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const color = toneColor(tone ?? 'neutral')
  return (
    <View style={consoleStyles.miniStat}>
      <Text style={{ color: tokens.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: tone === undefined ? tokens.text : color, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  )
}

export function StatRow({ stats }: { stats: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }[] }) {
  return (
    <View style={consoleStyles.statRow}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MiniStat label={stat.label} value={stat.value} tone={stat.tone} />
          {i < stats.length - 1 && <View style={consoleStyles.divider} />}
        </View>
      ))}
    </View>
  )
}

export function toneColor(tone: string) {
  if (tone === 'success') return tokens.success
  if (tone === 'warning') return tokens.warning
  if (tone === 'danger') return tokens.danger
  return tokens.muted
}

export function StatusPill({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const tc = toneColor(tone)
  return (
    <View style={[consoleStyles.statusPill, { borderColor: tc + '60', backgroundColor: tc + '15' }]}>
      <Text style={[consoleStyles.statusPillText, { color: tc }]}>{label}</Text>
    </View>
  )
}

export function SectionHero({ body, eyebrow, icon, title }: { body: string; eyebrow: string; icon: IconName; title: string }) {
  return (
    <View style={consoleStyles.heroCard}>
      <View style={consoleStyles.heroIcon}>
        <Icon name={icon} size={24} color={tokens.accentSoft} />
      </View>
      <Text style={consoleStyles.eyebrow}>{eyebrow}</Text>
      <Text style={consoleStyles.heroTitle}>{title}</Text>
      <Text style={consoleStyles.heroBody}>{body}</Text>
    </View>
  )
}

export function SectionHeading({ detail, title }: { detail: string; title: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={consoleStyles.sectionTitle}>{title}</Text>
      <Text style={consoleStyles.sectionBody}>{detail}</Text>
    </View>
  )
}

export function SimpleRow({ detail, icon, meta, title }: { detail: string; icon: IconName; meta: string; title: string }) {
  return (
    <View style={consoleStyles.simpleRow}>
      <Icon name={icon} size={18} color={tokens.accentSoft} />
      <View style={{ flex: 1 }}>
        <Text style={consoleStyles.rowTitle}>{title}</Text>
        <Text style={consoleStyles.rowDetail}>{detail}</Text>
      </View>
      <Text style={consoleStyles.rowMeta}>{meta}</Text>
    </View>
  )
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={consoleStyles.metric}>
      <Text style={consoleStyles.metricLabel}>{label}</Text>
      <Text style={consoleStyles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

export function ClaimChips({ claims }: { claims: string[] }) {
  return (
    <View style={consoleStyles.claimRow}>
      {claims.map((claim) => (
        <View key={claim} style={consoleStyles.claimChip}>
          <Text style={consoleStyles.claimText}>{CLAIM_LABELS[claim] ?? claim}</Text>
        </View>
      ))}
    </View>
  )
}

export function SimpleFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={consoleStyles.factRow}>
      <Text style={consoleStyles.factLabel}>{label}</Text>
      <Text style={consoleStyles.factValue}>{value}</Text>
    </View>
  )
}

export function EmptyCard({ body, icon, title }: { body: string; icon: IconName; title: string }) {
  return (
    <View style={consoleStyles.emptyCard}>
      <Icon name={icon} size={28} color={tokens.muted} />
      <Text style={consoleStyles.cardTitle}>{title}</Text>
      <Text style={consoleStyles.cardBodyText}>{body}</Text>
    </View>
  )
}

export function NotificationCard({
  notification,
  onDismissNotification,
}: {
  notification: NotificationItem
  onDismissNotification: (id: string) => void
}) {
  return (
    <View style={consoleStyles.notificationCard}>
      <Icon name={notification.icon} size={18} color={toneColor(notification.severity)} />
      <View style={{ flex: 1 }}>
        <Text style={consoleStyles.rowTitle}>{notification.title}</Text>
        {notification.body ? <Text style={consoleStyles.rowDetail}>{notification.body}</Text> : null}
        <Text style={consoleStyles.rowMeta}>{notification.time}</Text>
      </View>
      {notification.action ? (
        <Pressable onPress={notification.action.onPress} style={consoleStyles.textButton}>
          <Text style={consoleStyles.textButtonLabel}>{notification.action.label}</Text>
        </Pressable>
      ) : null}
      {notification.source === 'user' ? (
        <Pressable onPress={() => onDismissNotification(notification.id)} style={consoleStyles.textButton}>
          <Text style={consoleStyles.textButtonLabel}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/**
 * Single style source for console UI. Sections and primitives both consume
 * this sheet — do not fork per-screen copies (the old Console/styles.ts was
 * merged here).
 */
export const consoleStyles = StyleSheet.create({
  // Layout
  stack: {
    gap: 14,
  },
  listBlock: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tokens.surfaceTransparent,
    marginBottom: 6,
  },
  coreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor: tokens.surfaceTransparent,
    marginBottom: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  disabled: {
    opacity: 0.5,
  },

  // Hero & headings
  heroCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: tokens.accentTransparent,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
    gap: 6,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surfaceTransparent,
    marginBottom: 4,
  },
  topStatus: {
    gap: 12,
  },
  appMark: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  screenTitle: {
    color: tokens.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
  },
  screenSubtle: {
    color: tokens.muted,
    fontSize: 13,
    marginTop: 2,
  },
  eyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
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
  sectionTitle: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionBody: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 19,
  },

  // Pills & status
  statusPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Metrics
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  metricLabel: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
  },
  miniStat: {
    alignItems: 'flex-start',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.glassBorder,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: tokens.glassBorder,
    marginHorizontal: 14,
  },

  // Cards & rows
  personaCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
    gap: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: tokens.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardMeta: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  cardBodyText: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  receiptCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 13,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  surfaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 13,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  surfaceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surfaceStateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  surfaceState: {
    flex: 1,
    borderRadius: 12,
    padding: 8,
    backgroundColor: tokens.surfaceTransparent,
  },
  surfaceStateLabel: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  surfaceStateValue: {
    color: tokens.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 13,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  rowTitle: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rowDetail: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  rowMeta: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: 92,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 18,
    gap: 8,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },

  // Inputs & buttons
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surfaceRaised,
    color: tokens.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginTop: 8,
  },
  fullButton: {
    marginTop: 10,
    minHeight: 46,
  },
  textButton: {
    paddingVertical: 4,
  },
  textButtonLabel: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '800',
  },

  // Claims & facts
  claimRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  claimChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: tokens.surfaceTransparent,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  claimText: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  factLabel: {
    color: tokens.muted,
    fontSize: 12,
  },
  factValue: {
    color: tokens.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },

  // Progress rail
  progressRail: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  progressStep: {
    flex: 1,
    gap: 6,
    alignItems: 'center',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: tokens.accent,
    borderColor: tokens.accent,
  },
  progressLabel: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  progressLabelDone: {
    color: tokens.text,
  },
})
