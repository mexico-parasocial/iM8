import {
  createSeed,
  destroySeed,
  getBackupState,
  getIdentity,
  getIdentityPublicKeys,
  hasSeed,
  markBackupComplete,
  restoreSeedFromMnemonic,
  revealBackupMnemonic,
  SecureStoreUnavailableError,
  type BackupState,
} from './seedVault'
import { personaKeyRef } from './personaIdentity'
import type { PersonaKind } from '../types'

/**
 * Enrollment: the flow that gives this device an identity of its own.
 *
 * Until this runs, iM8 has no key. The session DID was built from the typed
 * handle (`did:web:<handle>.m8.local`), so it identified a string rather than a
 * keyholder — nothing could be signed with it and nothing could be proved about
 * it. Everything downstream (signing a challenge, verifying an artifact,
 * holding a portable credential) needs a real key first.
 *
 * Orchestration only: custody stays in seedVault, math stays in keyDerivation.
 * Keeping it that way is what lets this be tested without a device.
 */

export type EnrollmentState =
  /** No seed on this device — the user must create or restore one. */
  | { kind: 'absent' }
  /** Seed exists but the recovery phrase has never been written down. */
  | { kind: 'unbacked'; did: string }
  /** Seed exists and the user confirmed they saved the phrase. */
  | { kind: 'ready'; did: string }
  /** This platform cannot hold a key at all (notably web). */
  | { kind: 'unsupported'; reason: string }

/**
 * A DID that names the key, not the handle.
 *
 * The identity is its own public key, so whoever receives it can verify a
 * signature without asking a server who this is. A handle-derived DID can only
 * ever be looked up; this one can be checked.
 */
export function didForPublicKey(pubHex: string): string {
  return `did:key:z${pubHex}`
}

export interface EnrolledIdentity {
  did: string
  /** Public keys per derivation label — never the private scalars. */
  publicKeys: Record<string, string>
  backup: BackupState
}

async function describeIdentity(
  persona: PersonaKind,
  card: number,
): Promise<EnrolledIdentity> {
  const ref = personaKeyRef(persona, card)
  const identity = await getIdentity(ref.label, ref.card)
  return {
    did: didForPublicKey(identity.pubHex),
    publicKeys: await getIdentityPublicKeys(),
    backup: await getBackupState(),
  }
}

/** Where enrollment currently stands. Safe to call on any platform. */
export async function getEnrollmentState(
  persona: PersonaKind = 'public',
  card = 0,
): Promise<EnrollmentState> {
  try {
    if (!(await hasSeed())) return { kind: 'absent' }

    const ref = personaKeyRef(persona, card)
    const identity = await getIdentity(ref.label, ref.card)
    const did = didForPublicKey(identity.pubHex)
    const backup = await getBackupState()

    return backup === 'done' ? { kind: 'ready', did } : { kind: 'unbacked', did }
  } catch (error) {
    if (error instanceof SecureStoreUnavailableError) {
      return { kind: 'unsupported', reason: error.message }
    }
    throw error
  }
}

/**
 * Create a brand-new identity on this device.
 *
 * Refuses if a seed already exists: silently replacing one would destroy every
 * credential derived from it, with no way back unless the user still holds the
 * old phrase.
 */
export async function enrollNewIdentity(
  persona: PersonaKind = 'public',
  card = 0,
): Promise<EnrolledIdentity> {
  if (await hasSeed()) {
    throw new Error(
      'This device already holds an identity. Destroy it explicitly before creating another.',
    )
  }
  await createSeed()
  return describeIdentity(persona, card)
}

/** Restore an identity from its 24-word recovery phrase. */
export async function enrollFromMnemonic(
  mnemonic: string,
  persona: PersonaKind = 'public',
  card = 0,
): Promise<EnrolledIdentity> {
  await restoreSeedFromMnemonic(mnemonic)
  return describeIdentity(persona, card)
}

/** The DID for one specific card, e.g. a second anonymous voice. */
export async function didForPersonaCard(
  persona: PersonaKind,
  card: number,
): Promise<string> {
  const ref = personaKeyRef(persona, card)
  const identity = await getIdentity(ref.label, ref.card)
  return didForPublicKey(identity.pubHex)
}

/**
 * The recovery phrase, for the backup ceremony only.
 *
 * Render it once and let it go: never log it, never put it in navigation
 * params, never leave it in state that outlives the screen.
 */
export async function revealRecoveryPhrase(): Promise<string> {
  return revealBackupMnemonic()
}

/** Record that the user has written the phrase down. */
export async function confirmRecoveryPhraseSaved(): Promise<void> {
  await markBackupComplete()
}

/**
 * Irreversibly forget this identity. Everything derived from the seed becomes
 * unrecoverable unless the user still holds the phrase.
 */
export async function forgetIdentity(): Promise<void> {
  await destroySeed()
}
