import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  ClaimChips,
  consoleStyles,
  SectionHeading,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { tokens } from '../../../theme'
import type {
  NewSurfaceInput,
  Persona,
  Signal,
  SocialProvider,
  SurfaceId,
  SurfaceTemplate,
} from '../../../types'
import { SURFACE_META } from '../constants'

export function SurfaceDetailCard({
  surface,
  isExpanded,
  onToggle,
  onEdit,
  persona,
  isVerified,
  onStartVerification,
  onRequestParaGrant,
  requestingPara,
  supportedClaims,
  onToggleSignalSurface,
}: {
  surface: SurfaceTemplate | NewSurfaceInput
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  persona: Persona
  isVerified: boolean
  onStartVerification: () => void
  onRequestParaGrant: () => Promise<void>
  requestingPara: boolean
  supportedClaims: string[]
  onToggleSignalSurface: (signalLabel: string, surfaceId: SurfaceId) => void
}) {
  const base = surface.id in SURFACE_META ? SURFACE_META[surface.id as SurfaceId] : null
  const surfaceId = (surface.id in SURFACE_META ? surface.id : null) as SurfaceId | null
  const color = base?.color ?? tokens.accent

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}>
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: color + '20' }]}>
            <Icon name={base?.icon ?? 'grid'} size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={consoleStyles.rowTitle}>{surface.name}</Text>
            <Text style={consoleStyles.rowDetail}>{surface.audience}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StatusPill label={surface.status} tone={surface.status === 'Live' ? 'success' : 'neutral'} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable onPress={onEdit} hitSlop={8} style={styles.editButton}>
                <Icon name="pencil" size={12} color={tokens.muted} />
              </Pressable>
              <View style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}>
                <Icon name="chevronRight" size={14} color={tokens.muted} />
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      {isExpanded && (
        <View style={styles.expanded}>
          {surface.detail ? (
            <Text style={styles.surfaceDetail}>{surface.detail}</Text>
          ) : null}

          {/* PARA — civic surface only */}
          {surfaceId === 'civic' && (
            <View style={styles.paraCard}>
              <View style={consoleStyles.rowBetween}>
                <Text style={consoleStyles.cardTitle}>PARA</Text>
                <StatusPill label={isVerified ? 'Unlocked' : 'Locked'} tone={isVerified ? 'success' : 'neutral'} />
              </View>

              {!isVerified ? (
                <Pressable onPress={onStartVerification} style={buttonStyle('primary')}>
                  <Text style={buttonTextStyle('primary')}>Verify before using PARA</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void onRequestParaGrant()}
                  disabled={requestingPara}
                  style={[buttonStyle('primary'), requestingPara && consoleStyles.disabled]}
                >
                  {requestingPara ? (
                    <ActivityIndicator color={tokens.onAccent} />
                  ) : (
                    <Text style={buttonTextStyle('primary')}>Start a PARA proof request</Text>
                  )}
                </Pressable>
              )}

              <ClaimChips claims={supportedClaims} />
            </View>
          )}

          {/* Signal assignment — filtered by surface */}
          <SectionHeading
            title="Signals on this surface"
            detail="Toggle which identity signals are shared in this context."
          />
          {persona.signals
            .filter((signal) => surface.signalLabels.includes(signal.label))
            .map((signal) => {
              const assigned = surfaceId ? (signal.surfaces ?? []).includes(surfaceId) : true
              return (
                <View key={signal.label} style={styles.signalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.signalLabel}>{signal.label}</Text>
                    <Text style={styles.signalValue}>{signal.value}</Text>
                  </View>
                  {surfaceId && (
                    <Switch
                      value={assigned}
                      onValueChange={() => onToggleSignalSurface(signal.label, surfaceId)}
                      trackColor={{ false: tokens.stroke, true: color }}
                      thumbColor={assigned ? tokens.text : tokens.muted}
                    />
                  )}
                </View>
              )
            })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expanded: {
    paddingHorizontal: 13,
    paddingBottom: 13,
    gap: 12,
  },
  surfaceDetail: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  paraCard: {
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: tokens.surfaceTransparent,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    backgroundColor: tokens.surfaceTransparent,
  },
  signalLabel: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '600',
  },
  signalValue: {
    color: tokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  editButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
})
