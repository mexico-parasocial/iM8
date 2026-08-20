import { getRandomBytes } from 'expo-crypto'
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils'
import { deriveAllIdentities, mnemonicToSeed, seedToMnemonic } from './keyDerivation'
import type { DerivedIdentity, IdentityLabel } from './keyDerivation'

let SecureStore: typeof import('expo-secure-store') | null = null
try {
  SecureStore = require('expo-secure-store')
} catch {
  SecureStore = null
}

/*
 * Custody of the master seed. Unlike secureStorage.ts, there is deliberately
 * NO AsyncStorage fallback here: a seed in plaintext AsyncStorage would be
 * readable by any backup extraction or debug tooling. If the platform cannot
 * provide hardware-backed storage, seed creation must fail loudly instead of
 * degrading silently.
 *
 * Only the seed is persisted. Identity keys are re-derived on demand and kept
 * in memory; private scalars never touch storage in any form.
 */

const SEED_KEY = 'm8.seed.v1'
const BACKUP_STATE_KEY = 'm8.seed.backup.v1'

const SECURE_OPTIONS = {
  keychainAccessible: SecureStore?.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const

export class SecureStoreUnavailableError extends Error {
  constructor() {
    super('Hardware-backed secure storage is unavailable; refusing to create or store a seed')
    this.name = 'SecureStoreUnavailableError'
  }
}

function requireStore(): typeof import('expo-secure-store') {
  if (!SecureStore) throw new SecureStoreUnavailableError()
  return SecureStore
}

export async function hasSeed(): Promise<boolean> {
  if (!SecureStore) return false
  return (await SecureStore.getItemAsync(SEED_KEY)) != null
}

/** Generate and persist a fresh seed. Throws if one already exists. */
export async function createSeed(): Promise<void> {
  const store = requireStore()
  if (await hasSeed()) {
    throw new Error('A seed already exists; it must be explicitly destroyed before creating a new one')
  }
  const seed = getRandomBytes(32)
  await store.setItemAsync(SEED_KEY, bytesToHex(seed), SECURE_OPTIONS)
  await store.setItemAsync(BACKUP_STATE_KEY, 'pending', SECURE_OPTIONS)
}

/** Restore from a backup mnemonic, replacing nothing (throws if a seed exists). */
export async function restoreSeedFromMnemonic(mnemonic: string): Promise<void> {
  const store = requireStore()
  if (await hasSeed()) {
    throw new Error('A seed already exists; it must be explicitly destroyed before restoring')
  }
  const seed = mnemonicToSeed(mnemonic)
  await store.setItemAsync(SEED_KEY, bytesToHex(seed), SECURE_OPTIONS)
  // A restored seed was, by definition, backed up.
  await store.setItemAsync(BACKUP_STATE_KEY, 'done', SECURE_OPTIONS)
}

async function loadSeed(): Promise<Uint8Array> {
  const store = requireStore()
  const hex = await store.getItemAsync(SEED_KEY)
  if (!hex) throw new Error('No seed present')
  return hexToBytes(hex)
}

/**
 * The backup mnemonic for the current seed. Callers must treat this like the
 * seed itself: render it once for the backup ceremony, never log it, never
 * put it in navigation params or component state that outlives the screen.
 */
export async function revealBackupMnemonic(): Promise<string> {
  return seedToMnemonic(await loadSeed())
}

export async function markBackupComplete(): Promise<void> {
  const store = requireStore()
  await store.setItemAsync(BACKUP_STATE_KEY, 'done', SECURE_OPTIONS)
}

export type BackupState = 'none' | 'pending' | 'done'

export async function getBackupState(): Promise<BackupState> {
  if (!SecureStore) return 'none'
  if (!(await hasSeed())) return 'none'
  const state = await SecureStore.getItemAsync(BACKUP_STATE_KEY)
  return state === 'done' ? 'done' : 'pending'
}

/** Derive one identity on demand. The result stays in memory only. */
export async function getIdentity(label: IdentityLabel): Promise<DerivedIdentity> {
  const identities = deriveAllIdentities(await loadSeed())
  return identities[label]
}

/** Public keys for all three identities, e.g. for registration. */
export async function getIdentityPublicKeys(): Promise<Record<IdentityLabel, string>> {
  const identities = deriveAllIdentities(await loadSeed())
  return {
    public: identities.public.pubHex,
    civic: identities.civic.pubHex,
    anonymous: identities.anonymous.pubHex,
  }
}

/**
 * Irreversibly destroy the seed and backup state. Anything derived from the
 * seed becomes unrecoverable unless the user still holds the mnemonic.
 */
export async function destroySeed(): Promise<void> {
  const store = requireStore()
  await store.deleteItemAsync(SEED_KEY)
  await store.deleteItemAsync(BACKUP_STATE_KEY)
}
