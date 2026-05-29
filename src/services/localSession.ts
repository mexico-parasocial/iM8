import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildPersonas,
  buildCommunityAdmins,
  buildSignalProviders,
  buildIntegrations,
  buildSurfaceTemplates,
  buildCommandDeck,
  buildAppGrants,
  buildClaimRequests,
  buildProofArtifacts,
  buildPolicyChangeRequests,
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
  const communityAdmins = buildCommunityAdmins()

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
    publicLinks: [],
    communityAdmins,
    policyChangeRequests: buildPolicyChangeRequests(communityAdmins),
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
    const session = JSON.parse(raw) as IdentitySession
    return ensureLocalGovernanceState(session)
  } catch {
    return null
  }
}

export async function clearLocalSession(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_SESSION_KEY)
}

function ensureLocalGovernanceState(session: IdentitySession): IdentitySession {
  const communityAdmins = session.communityAdmins && session.communityAdmins.length === 3
    ? session.communityAdmins
    : buildCommunityAdmins()

  return {
    ...session,
    communityAdmins,
    policyChangeRequests: session.policyChangeRequests && session.policyChangeRequests.length > 0
      ? session.policyChangeRequests
      : buildPolicyChangeRequests(communityAdmins),
    publicLinks: session.publicLinks ?? [],
  }
}
