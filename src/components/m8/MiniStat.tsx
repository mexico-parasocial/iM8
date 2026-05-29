import { View, Text, StyleSheet } from 'react-native'
import { tokens } from '../../theme'

export function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const toneColor =
    tone === 'success'
      ? tokens.success
      : tone === 'warning'
        ? tokens.warning
        : tone === 'danger'
          ? tokens.danger
          : tokens.text

  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={[styles.miniStatValue, { color: toneColor }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  miniStat: {
    flex: 1,
    minWidth: 72,
    borderRadius: 16,
    padding: 12,
    backgroundColor: tokens.surfaceTransparent,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  miniStatLabel: {
    color: tokens.muted,
    fontSize: 11,
  },
  miniStatValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
})
