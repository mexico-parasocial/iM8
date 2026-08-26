import AsyncStorage from '@react-native-async-storage/async-storage'

/*
 * Presence of the module is not proof of a working keystore. On web,
 * expo-secure-store resolves to `export default {}` — the require succeeds, so
 * a null-check passes and the first call dies with "setItemAsync is not a
 * function". Probe the methods we actually call.
 */
function loadSecureStore(): typeof import('expo-secure-store') | null {
  try {
    const mod = require('expo-secure-store')
    const candidate = mod?.setItemAsync ? mod : mod?.default
    const usable =
      typeof candidate?.setItemAsync === 'function' &&
      typeof candidate?.getItemAsync === 'function' &&
      typeof candidate?.deleteItemAsync === 'function'
    return usable ? candidate : null
  } catch {
    return null
  }
}

const SecureStore = loadSecureStore()

/**
 * True when values written here land in the OS keystore. False means the
 * AsyncStorage fallback is in play: plaintext on disk, readable by backup
 * extraction and by anything with filesystem access.
 *
 * Callers holding anything stronger than a short-lived token should check this
 * and refuse, the way seedVault refuses outright. It is exported so that
 * refusal is a decision a caller makes explicitly rather than a silent
 * downgrade nobody notices.
 */
export const isHardwareBacked = SecureStore !== null

/** Thrown by the `*OrThrow` helpers when no keystore is available. */
export class InsecureStorageError extends Error {
  constructor(key: string) {
    super(
      `Refusing to store "${key}": no hardware-backed keystore on this platform`,
    )
    this.name = 'InsecureStorageError'
  }
}

if (!isHardwareBacked && __DEV__) {
  console.warn(
    '[secureStorage] No hardware-backed keystore; falling back to AsyncStorage. ' +
      'Values stored here are NOT encrypted at rest.',
  )
}

/**
 * Sensitive-but-replaceable values (broker tokens, session snapshot).
 * Degrades to AsyncStorage where no keystore exists — acceptable only because
 * everything stored through here can be revoked and re-issued. The master seed
 * cannot, which is why it lives in seedVault and never touches this path.
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

/** Like secureSet, but refuses rather than degrading. */
export async function secureSetOrThrow(key: string, value: string): Promise<void> {
  if (!SecureStore) throw new InsecureStorageError(key)
  return SecureStore.setItemAsync(key, value)
}

/** Like secureGet, but refuses rather than reading from plaintext storage. */
export async function secureGetOrThrow(key: string): Promise<string | null> {
  if (!SecureStore) throw new InsecureStorageError(key)
  return SecureStore.getItemAsync(key)
}
