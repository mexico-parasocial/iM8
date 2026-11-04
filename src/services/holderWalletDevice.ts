import { getRandomBytes } from 'expo-crypto'
import { requestJson } from './brokerApi'
import {
  createHolderWallet,
  HOLDER_WALLET_ENABLED,
  type HolderWallet,
  type WalletBrokerApi,
  type WalletSecureStore,
} from './holderWallet'

/*
 * Device bindings for the holder wallet. Kept out of holderWallet.ts so the
 * wallet logic runs under `tsx --test` without Expo.
 *
 * Custody, as in seedVault: no AsyncStorage fallback. Every item is
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY — never synced to iCloud Keychain, never in
 * a backup, gone with the device. The private key additionally requires user
 * presence to read (requireAuthentication): each presentation or binding asks
 * for biometrics or the passcode. On iOS that item becomes unreadable if the
 * enrolled biometrics change; the wallet reports the key lost and the user
 * recovers by revoking and re-enrolling. Whether that holds on each target
 * device is what the device test pass has to establish before
 * HOLDER_WALLET_ENABLED can be set.
 *
 * Known limit: this is a Keychain/Keystore item, not a non-exportable
 * hardware key. Ed25519 is not available in the Secure Enclave, so malware
 * with code execution in the app after unlock can read the key.
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

export class HolderWalletUnavailableError extends Error {
  constructor(reason: string) {
    super(`Holder wallet unavailable: ${reason}`)
    this.name = 'HolderWalletUnavailableError'
  }
}

function deviceStore(): WalletSecureStore {
  const SecureStore = loadSecureStore()
  if (!SecureStore) throw new HolderWalletUnavailableError('no hardware-backed keystore on this platform')
  const options = (userPresence: boolean) => ({
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: userPresence,
    ...(userPresence ? { authenticationPrompt: 'Confirm to use your iM8 wallet key' } : {}),
  })
  return {
    set: (key, value, { userPresence }) => SecureStore.setItemAsync(key, value, options(userPresence)),
    async get(key, { userPresence }) {
      try {
        return await SecureStore.getItemAsync(key, options(userPresence))
      } catch {
        // Cancelled prompt, or an item invalidated by a biometric change.
        return null
      }
    },
    delete: (key) => SecureStore.deleteItemAsync(key),
  }
}

const deviceApi: WalletBrokerApi = {
  get: (path) => requestJson(path, { method: 'GET' }),
  async find(path) {
    try {
      return await requestJson(path, { method: 'GET' })
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null
      throw error
    }
  },
  post: (path, body) =>
    requestJson(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
}

/** The production wallet. Refuses while HOLDER_WALLET_ENABLED is false. */
export function createDeviceHolderWallet(trustedIssuerKeys: string[] = []): HolderWallet {
  if (!HOLDER_WALLET_ENABLED) {
    throw new HolderWalletUnavailableError('gated until device tests and a real issuer integration pass')
  }
  return createHolderWallet({
    store: deviceStore(),
    api: deviceApi,
    randomBytes: (length) => getRandomBytes(length),
    trustedIssuerKeys,
  })
}
