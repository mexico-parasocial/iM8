import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildPersonas,
  buildSignalProviders,
  buildIntegrations,
  buildSurfaceTemplates,
  buildCommandDeck,
  buildAppGrants,
  buildClaimRequests,
  buildProofArtifacts,
} from '../poc-data'
import {
  buildClaimCatalog,
  buildConsentLedger,
  buildConsentPolicy,
  buildPdsSafetyPolicy,
  buildProofLifecycleCopy,
  buildSafetyActions,
  buildSafetySnapshot,
} from './trustPolicy'
import { buildParaProviderStatus } from './paraAdapter'
import type { IdentitySession } from '../types'

const LOCAL_SESSION_KEY = 'm8_local_session_v2'

function sanitizeHandle(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return cleaned || 'user'
}

function buildDisplayName(handle: string): string {
  const root = handle.split('.')[0]
  return root.charAt(0).toUpperCase() + root.slice(1)
}

function buildLocalProviders(handle: string) {
  const paraStatus = buildParaProviderStatus(handle)
  return buildSignalProviders().map((provider) =>
    provider.id === 'para-verifier'
      ? {
          ...provider,
          status: paraStatus.availability === 'Online' ? ('Core' as const) : ('Degraded' as const),
          summary: paraStatus.detail,
          lastSync: paraStatus.lastSync,
        }
      : provider
  )
}

export function buildLocalSession(handle: string): IdentitySession {
  const cleanHandle = sanitizeHandle(handle)
  const fullHandle = `${cleanHandle}.m8.local`

  return {
    brokerMode: 'local',
    did: `did:web:${fullHandle}`,
    handle: fullHandle,
    displayName: buildDisplayName(cleanHandle),
    renameStatus: 'locked',
    authorizationServer: 'https://auth.m8.local',
    pdsSafety: buildSafetySnapshot(fullHandle),
    paraProvider: buildParaProviderStatus(fullHandle),
    claimCatalog: buildClaimCatalog(),
    consentPolicy: buildConsentPolicy(),
    proofLifecycle: buildProofLifecycleCopy(),
    pdsSafetyPolicy: buildPdsSafetyPolicy(),
    personas: buildPersonas(fullHandle),
    pendingRequests: buildClaimRequests(),
    grants: buildAppGrants(),
    proofArtifacts: buildProofArtifacts(),
    consentLedger: buildConsentLedger(),
    providers: buildLocalProviders(fullHandle),
    integrations: buildIntegrations(),
    safetyActions: buildSafetyActions(),
    surfaceTemplates: buildSurfaceTemplates(),
    commands: buildCommandDeck(),
  }
}

export async function saveLocalSession(session: IdentitySession): Promise<void> {
  await AsyncStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session))
}

export async function loadLocalSession(): Promise<IdentitySession | null> {
  const raw = await AsyncStorage.getItem(LOCAL_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as IdentitySession
  } catch {
    return null
  }
}

export async function clearLocalSession(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_SESSION_KEY)
}
