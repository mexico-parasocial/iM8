import { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import * as LocalAuthentication from 'expo-local-authentication'
import { Icon } from './Icon'
import { tokens } from '../../theme'
import { hapticLight, hapticMedium } from '../../utils/haptics'

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_HEIGHT = 420
const SPRING = { damping: 25, stiffness: 300 }

export function SettingsSheet({
  visible,
  onClose,
  darkMode,
  onToggleDarkMode,
  biometricEnabled,
  onToggleBiometric,
  onSignOut,
}: {
  visible: boolean
  onClose: () => void
  darkMode: boolean
  onToggleDarkMode: (v: boolean) => void
  biometricEnabled: boolean
  onToggleBiometric: (v: boolean) => void
  onSignOut: () => void
}) {
  const translateY = useSharedValue(SCREEN_H)
  const backdropOpacity = useSharedValue(0)

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false)
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false)

  // Check biometric hardware when sheet opens
  useEffect(() => {
    if (!visible) return
    LocalAuthentication.hasHardwareAsync().then((hw) => {
      setHasBiometricHardware(hw)
      if (hw) {
        LocalAuthentication.isEnrolledAsync().then(setIsBiometricEnrolled)
      }
    })
  }, [visible])

  // Animate in when visible changes (must be in useEffect, not render body)
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING)
      backdropOpacity.value = withSpring(0.5, SPRING)
    }
  }, [visible])

  function dismiss() {
    translateY.value = withSpring(SCREEN_H, SPRING, () => {
      runOnJS(onClose)()
    })
    backdropOpacity.value = withSpring(0, SPRING)
  }

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        translateY.value = withSpring(SCREEN_H, SPRING, () => {
          runOnJS(onClose)()
        })
        backdropOpacity.value = withSpring(0, SPRING)
      } else {
        translateY.value = withSpring(0, SPRING)
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  return (
    <Modal visible={visible} transparent animationType="none">
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        {/* Sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, sheetStyle]}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Settings</Text>
              <Pressable onPress={dismiss} style={{ padding: 4 }}>
                <Icon name="circleX" size={20} color={tokens.muted} />
              </Pressable>
            </View>

            {/* Sections */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appearance</Text>
              <SettingsRow
                icon="moon"
                label="Dark mode"
                control={
                  <Switch
                    value={darkMode}
                    onValueChange={(v) => {
                      hapticLight()
                      onToggleDarkMode(v)
                    }}
                    trackColor={{ false: tokens.stroke, true: tokens.accent }}
                    thumbColor={darkMode ? tokens.text : tokens.muted}
                  />
                }
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security</Text>
              <SettingsRow
                icon="shieldCheck"
                label="Biometric lock"
                detail={
                  !hasBiometricHardware
                    ? 'Not available on this device'
                    : !isBiometricEnrolled
                    ? 'No biometrics enrolled'
                    : undefined
                }
                control={
                  <Switch
                    value={biometricEnabled}
                    onValueChange={(v) => {
                      hapticLight()
                      onToggleBiometric(v)
                    }}
                    trackColor={{ false: tokens.stroke, true: tokens.success }}
                    thumbColor={biometricEnabled ? tokens.text : tokens.muted}
                    disabled={!hasBiometricHardware || !isBiometricEnrolled}
                  />
                }
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              {!showSignOutConfirm ? (
                <Pressable
                  onPress={() => {
                    hapticMedium()
                    setShowSignOutConfirm(true)
                  }}
                  style={styles.destructiveRow}
                >
                  <Icon name="circleX" size={18} color={tokens.danger} />
                  <Text style={styles.destructiveText}>Sign out</Text>
                </Pressable>
              ) : (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmText}>
                    Are you sure? Your local identity will be removed from this device.
                  </Text>
                  <View style={styles.confirmActions}>
                    <Pressable
                      onPress={() => setShowSignOutConfirm(false)}
                      style={[styles.confirmButton, { backgroundColor: tokens.surfaceRaised }]}
                    >
                      <Text style={{ color: tokens.text, fontWeight: '600' }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        hapticMedium()
                        dismiss()
                        onSignOut()
                      }}
                      style={[styles.confirmButton, { backgroundColor: tokens.danger }]}
                    >
                      <Text style={{ color: tokens.onDanger, fontWeight: '700' }}>Sign out</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Version</Text>
                <Text style={styles.aboutValue}>m8 Console v0.1</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Build</Text>
                <Text style={styles.aboutValue}>poc-2026.05.19</Text>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

function SettingsRow({
  icon,
  label,
  detail,
  control,
}: {
  icon: string
  label: string
  detail?: string
  control: React.ReactNode
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Icon name={icon as never} size={18} color={tokens.text} />
        <View>
          <Text style={styles.rowLabel}>{label}</Text>
          {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
        </View>
      </View>
      {control}
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.stroke,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '800',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowDetail: {
    color: tokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.dangerTransparent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: tokens.dangerBorder,
  },
  destructiveText: {
    color: tokens.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmRow: {
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  confirmText: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aboutLabel: {
    color: tokens.muted,
    fontSize: 14,
  },
  aboutValue: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '500',
  },
})
