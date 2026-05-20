import { View, Text, StyleSheet } from 'react-native'
import { Icon, type IconName } from './Icon'
import { tokens } from '../../theme'

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
})
