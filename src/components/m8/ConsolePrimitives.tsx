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
    <View style={styles.row}>
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
    <View style={styles.coreRow}>
      <Text style={{ color: tokens.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: tokens.text, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

export function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneColor = tone === 'success' ? tokens.success : tone === 'warning' ? tokens.warning : tone === 'danger' ? tokens.danger : tokens.text
  return (
    <View style={styles.miniStat}>
      <Text style={{ color: tokens.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: toneColor, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  )
}

export function StatRow({ stats }: { stats: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }[] }) {
  return (
    <View style={styles.statRow}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MiniStat label={stat.label} value={stat.value} tone={stat.tone} />
          {i < stats.length - 1 && <View style={styles.divider} />}
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
    <View style={[styles.statusPill, { borderColor: tc + '60', backgroundColor: tc + '15' }]}>
      <Text style={[styles.statusPillText, { color: tc }]}>{label}</Text>
    </View>
  )
}

export function SectionHero({ body, eyebrow, icon, title }: { body: string; eyebrow: string; icon: IconName; title: string }) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroIcon}>
        <Icon name={icon} size={24} color={tokens.accentSoft} />
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroBody}>{body}</Text>
    </View>
  )
}

export function SectionHeading({ detail, title }: { detail: string; title: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{detail}</Text>
    </View>
  )
}

export function SimpleRow({ detail, icon, meta, title }: { detail: string; icon: IconName; meta: string; title: string }) {
  return (
    <View style={styles.simpleRow}>
      <Icon name={icon} size={18} color={tokens.accentSoft} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Text style={styles.rowMeta}>{meta}</Text>
    </View>
  )
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

export function ClaimChips({ claims }: { claims: string[] }) {
  return (
    <View style={styles.claimRow}>
      {claims.map((claim) => (
        <View key={claim} style={styles.claimChip}>
          <Text style={styles.claimText}>{CLAIM_LABELS[claim] ?? claim}</Text>
        </View>
      ))}
    </View>
  )
}

export function SimpleFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  )
}

export function EmptyCard({ body, icon, title }: { body: string; icon: IconName; title: string }) {
  return (
    <View style={styles.emptyCard}>
      <Icon name={icon} size={28} color={tokens.muted} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBodyText}>{body}</Text>
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
    <View style={styles.notificationCard}>
      <Icon name={notification.icon} size={18} color={toneColor(notification.severity)} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{notification.title}</Text>
        {notification.body ? <Text style={styles.rowDetail}>{notification.body}</Text> : null}
        <Text style={styles.rowMeta}>{notification.time}</Text>
      </View>
      {notification.action ? (
        <Pressable onPress={notification.action.onPress} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>{notification.action.label}</Text>
        </Pressable>
      ) : null}
      {notification.source === 'user' ? (
        <Pressable onPress={() => onDismissNotification(notification.id)} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
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
  emptyCard: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 18,
    gap: 8,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  cardTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardBodyText: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 19,
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
  textButton: {
    paddingVertical: 4,
  },
  textButtonLabel: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '800',
  },
})
