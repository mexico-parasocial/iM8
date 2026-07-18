import AsyncStorage from '@react-native-async-storage/async-storage'

let SecureStore: typeof import('expo-secure-store') | null = null
try {
  SecureStore = require('expo-secure-store')
} catch {
  // expo-secure-store native module not available (Expo Go, dev, web)
}

/**
 * Sensitive storage (broker tokens, local session snapshot, identity data):
 * Keychain/Keystore via expo-secure-store when available, AsyncStorage
 * fallback otherwise (dev/web). Non-sensitive prefs stay in AsyncStorage.
 */
export async function secureSet(key: string, value: string): Promise<void> {
  if (SecureStore) {
    return SecureStore.setItemAsync(key, value)
  }
  return AsyncStorage.setItem(key, value)
}

export async function secureGet(key: string): Promise<string | null> {
  if (SecureStore) {
    return SecureStore.getItemAsync(key)
  }
  return AsyncStorage.getItem(key)
}

export async function secureDelete(key: string): Promise<void> {
  if (SecureStore) {
    return SecureStore.deleteItemAsync(key)
  }
  return AsyncStorage.removeItem(key)
}
