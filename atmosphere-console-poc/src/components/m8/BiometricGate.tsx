import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  type AppStateStatus,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuthentication from 'expo-local-authentication'
import { buttonStyle, buttonTextStyle } from './Button'
import { Icon } from './Icon'
import { tokens } from '../../theme'

const BIOMETRIC_ENABLED_KEY = '@m8/biometric-enabled'
const LAST_BACKGROUND_KEY = '@m8/last-background'
const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

async function authenticateBiometric(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    if (!hasHardware) {
      console.warn('[BiometricGate] No biometric hardware available')
      return false
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync()
    if (!isEnrolled) {
      console.warn('[BiometricGate] No biometrics enrolled')
      return false
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity',
      fallbackLabel: 'Use device PIN',
      disableDeviceFallback: false,
    })

    return result.success
  } catch (err) {
    console.error('[BiometricGate] Authentication error:', err)
    return false
  }
}

export function useBiometricGate() {
  const [isLocked, setIsLocked] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [hasHardware, setHasHardware] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const appState = useRef(AppState.currentState)

  // Load enabled setting and check hardware capabilities
  useEffect(() => {
    AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY).then((val) => {
      if (val !== null) setEnabled(val === 'true')
    })
    LocalAuthentication.hasHardwareAsync().then(setHasHardware)
    LocalAuthentication.isEnrolledAsync().then(setIsEnrolled)
  }, [])

  // Auto-lock on app foreground after timeout
  useEffect(() => {
    if (!enabled) return

    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const lastBg = await AsyncStorage.getItem(LAST_BACKGROUND_KEY)
        if (lastBg) {
          const elapsed = Date.now() - parseInt(lastBg, 10)
          if (elapsed > LOCK_TIMEOUT_MS) {
            setIsLocked(true)
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        await AsyncStorage.setItem(LAST_BACKGROUND_KEY, String(Date.now()))
      }
      appState.current = nextAppState
    })

    return () => subscription.remove()
  }, [enabled])

  async function unlock() {
    setIsAuthenticating(true)
    try {
      const success = await authenticateBiometric()
      if (success) setIsLocked(false)
      return success
    } finally {
      setIsAuthenticating(false)
    }
  }

  function lock() {
    setIsLocked(true)
  }

  async function toggleEnabled(value: boolean) {
    setEnabled(value)
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(value))
  }

  return { isLocked, isAuthenticating, unlock, lock, enabled, toggleEnabled, hasHardware, isEnrolled }
}

export function BiometricGateModal({
  visible,
  onUnlock,
  onCancel,
}: {
  visible: boolean
  onUnlock: () => void
  onCancel: () => void
}) {
  const [attempting, setAttempting] = useState(false)
  const [hardwareChecked, setHardwareChecked] = useState(false)
  const [hasHardware, setHasHardware] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)

  useEffect(() => {
    if (!visible) return
    LocalAuthentication.hasHardwareAsync().then((hw) => {
      setHasHardware(hw)
      if (hw) {
        LocalAuthentication.isEnrolledAsync().then(setIsEnrolled)
      }
      setHardwareChecked(true)
    })
  }, [visible])

  async function handleUnlock() {
    setAttempting(true)
    const success = await authenticateBiometric()
    setAttempting(false)
    if (success) {
      onUnlock()
    } else {
      Alert.alert('Authentication failed', 'Unable to verify your identity. Try again.')
    }
  }

  const unavailableMessage = !hardwareChecked
    ? 'Checking device capabilities...'
    : !hasHardware
    ? 'This device does not support biometric authentication.'
    : !isEnrolled
    ? 'No biometrics are enrolled on this device. Set up Face ID, Touch ID, or fingerprint in system settings.'
    : null

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <Icon name="lock" size={48} color={tokens.accent} />
          </View>
          <Text style={styles.title}>Identity vault locked</Text>
          <Text style={styles.body}>
            Your sensitive identity data is protected. Authenticate to continue.
          </Text>

          {unavailableMessage ? (
            <View style={styles.unavailableBox}>
              <Icon name="shield" size={20} color={tokens.warning} />
              <Text style={styles.unavailableText}>{unavailableMessage}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleUnlock}
              disabled={attempting || !hasHardware || !isEnrolled}
              style={[buttonStyle('primary'), (attempting || !hasHardware || !isEnrolled) && { opacity: 0.5 }]}
            >
              <Text style={buttonTextStyle('primary')}>
                {attempting ? 'Verifying...' : 'Unlock'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 24,
  },
  sheet: {
    backgroundColor: tokens.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    marginBottom: 8,
  },
  title: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  unavailableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.warning + '15',
    borderWidth: 1,
    borderColor: tokens.warning + '40',
    borderRadius: 14,
    padding: 12,
    width: '100%',
  },
  unavailableText: {
    color: tokens.warning,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
})
