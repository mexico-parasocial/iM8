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
import { buttonStyle, buttonTextStyle } from './Button'
import { cardStyle } from './Card'
import { tokens } from '../../theme'

const BIOMETRIC_ENABLED_KEY = '@m8/biometric-enabled'
const LAST_BACKGROUND_KEY = '@m8/last-background'
const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// NOTE: This is a platform-agnostic stub.
// For real biometric auth, install expo-local-authentication:
//   npx expo install expo-local-authentication
// Then replace the stub with:
//   import * as LocalAuthentication from 'expo-local-authentication'
//   const result = await LocalAuthentication.authenticateAsync({
//     promptMessage: 'Verify your identity',
//     fallbackLabel: 'Use passcode',
//   })
//   return result.success

async function authenticateBiometric(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 800)
  })
}

export function useBiometricGate() {
  const [isLocked, setIsLocked] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const appState = useRef(AppState.currentState)

  // Load enabled setting
  useEffect(() => {
    AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY).then((val) => {
      if (val !== null) setEnabled(val === 'true')
    })
  }, [])

  // Auto-lock on app foreground after timeout
  useEffect(() => {
    if (!enabled) return

    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground — check if we should lock
        const lastBg = await AsyncStorage.getItem(LAST_BACKGROUND_KEY)
        if (lastBg) {
          const elapsed = Date.now() - parseInt(lastBg, 10)
          if (elapsed > LOCK_TIMEOUT_MS) {
            setIsLocked(true)
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background — record timestamp
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

  return { isLocked, isAuthenticating, unlock, lock, enabled, toggleEnabled }
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

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.icon}>🔐</Text>
          <Text style={styles.title}>Identity vault locked</Text>
          <Text style={styles.body}>
            Your sensitive identity data is protected. Authenticate to continue.
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleUnlock}
              disabled={attempting}
              style={[buttonStyle('primary'), attempting && { opacity: 0.7 }]}
            >
              <Text style={buttonTextStyle('primary')}>
                {attempting ? 'Verifying...' : 'Unlock'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            In production, this uses Face ID / Touch ID / device PIN.
          </Text>
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
  icon: {
    fontSize: 48,
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
  hint: {
    color: tokens.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
})
