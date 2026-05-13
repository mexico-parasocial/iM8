import { View, Text, StyleSheet } from 'react-native'
import { tokens } from '../../theme'

export function EmptyState({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
      <Text style={{ fontSize: 32 }}>{icon}</Text>
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
      <Text style={{ color: toneColor, fontSize: 14, fontWeight: '700', marginTop: 6 }}>{value}</Text>
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
    borderWidth: 1,
    borderColor: tokens.stroke,
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
    flex: 1,
    minWidth: 72,
    borderRadius: 16,
    padding: 12,
    backgroundColor: tokens.surfaceTransparent,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
})
