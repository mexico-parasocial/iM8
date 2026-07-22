import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import Animated from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ConsoleLayout } from './Console/ConsoleLayout'
import { ConsoleHeader } from './Console/Header'
import { BottomNav } from './Console/Nav'
import { useNotifications } from '../hooks/useNotifications'
import type { DeepLinkRoute } from '../hooks/useDeepLink'
import { BiometricGateModal, useBiometricGate } from '../components/m8/BiometricGate'
import { IneVerificationModal } from '../components/m8/IneVerificationModal'
import { SurfaceBuilderModal } from '../components/m8/SurfaceBuilderModal'
import type {
  GrantRequestInput,
  IdentitySession,
  IneVerificationRecord,
  NewSurfaceInput,
  SocialProvider,
  SurfaceId,
  SurfaceState,
} from '../types'
import { SettingsSection } from './Console/sections/SettingsSection'
import { HomeSection } from './Console/sections/HomeSection'
import { IdentitySection } from './Console/sections/IdentitySection'
import { getRenameStatus, PUBLIC_SLOT_ID } from './Console/constants'

type ConsoleSectionId = 'dashboard' | 'identity' | 'settings'

const CONSOLE_UI_KEY = '@m8/console-ui'
const CUSTOM_SURFACES_KEY = '@m8/custom-surfaces'

export function ConsoleScreen({
  onApproveGrant,
  onApprovePolicyChange,
  onApplyPolicyChange,
  onRequestGrant,
  onRejectPolicyChange,
  onRevokeGrant,
  onSaveIneVerification,
  onCreatePublicPersona,
  onLinkPublicSocial,
  onSignOut,
  onUnlinkPublicSocial,
  onUpdateDisplayName,
  onUpdateSurfaceState,
  onRefreshSession,
  session,
  incomingRoute,
  onRouteHandled,
}: {
  onApproveGrant: (id: string) => Promise<void>
  onApprovePolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onApplyPolicyChange: (requestId: string) => Promise<void>
  onRequestGrant: (input: GrantRequestInput) => Promise<void>
  onRejectPolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onRevokeGrant: (id: string) => Promise<void>
  onSaveIneVerification: (record: IneVerificationRecord) => Promise<void>
  onCreatePublicPersona: (displayName: string) => Promise<void>
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
  onSignOut: () => void
  onUnlinkPublicSocial: (id: string) => Promise<void>
  onUpdateDisplayName: (displayName: string) => Promise<void>
  onUpdateSurfaceState: (personaId: string, surface: SurfaceId, state: SurfaceState) => Promise<void>
  onRefreshSession: () => Promise<void>
  session: IdentitySession
  incomingRoute?: DeepLinkRoute | null
  onRouteHandled?: () => void
}) {
  const isVerified = session.ineVerification?.status === 'verified'
  const renameStatus = getRenameStatus(session, isVerified)
  const [activeSection, setActiveSection] = useState<ConsoleSectionId>('dashboard')
  const [activePersonaId, setActivePersonaId] = useState(session.personas[0]?.id ?? '')
  const [refreshing, setRefreshing] = useState(false)
  const [uiRestored, setUiRestored] = useState(false)
  const [showSurfaceBuilder, setShowSurfaceBuilder] = useState(false)
  const [customSurfaces, setCustomSurfaces] = useState<NewSurfaceInput[]>([])
  const [showBiometricGate, setShowBiometricGate] = useState(false)
  const [showIneModal, setShowIneModal] = useState(false)
  const [renameInput, setRenameInput] = useState(session.verifiedDisplayName ?? session.displayName)
  const [savingName, setSavingName] = useState(false)
  const [requestingPara, setRequestingPara] = useState(false)
  const scrollRef = useRef<Animated.ScrollView>(null)
  const { unlock, enabled: biometricEnabled, toggleEnabled: toggleBiometric } = useBiometricGate()

  const {
    notifications,
    badgeCount,
    hasDanger,
    dismissNotification,
    markNotificationsRead,
  } = useNotifications(session, () => setActiveSection('dashboard'))

  // Restore persisted UI state (selected section/persona, custom surfaces) once on mount.
  useEffect(() => {
    if (uiRestored) return
    let cancelled = false
    void (async () => {
      try {
        const [uiRaw, surfacesRaw] = await Promise.all([
          AsyncStorage.getItem(CONSOLE_UI_KEY),
          AsyncStorage.getItem(CUSTOM_SURFACES_KEY),
        ])
        if (cancelled) return
        if (uiRaw) {
          const parsed = JSON.parse(uiRaw) as { activeSection?: string; activePersonaId?: string }
          // A pending deep link wins over the restored section.
          if (
            !incomingRoute &&
            (parsed.activeSection === 'dashboard' ||
              parsed.activeSection === 'identity' ||
              parsed.activeSection === 'settings')
          ) {
            setActiveSection(parsed.activeSection)
          }
          if (parsed.activePersonaId) {
            const hasPublic = session.personas.some((p) => p.kind === 'public')
            const valid =
              session.personas.some((p) => p.id === parsed.activePersonaId) ||
              (parsed.activePersonaId === PUBLIC_SLOT_ID && !hasPublic)
            if (valid) setActivePersonaId(parsed.activePersonaId)
          }
        }
        if (surfacesRaw) {
          const parsed = JSON.parse(surfacesRaw)
          if (Array.isArray(parsed)) setCustomSurfaces(parsed as NewSurfaceInput[])
        }
      } catch {
        // Corrupt or missing storage — keep defaults.
      } finally {
        if (!cancelled) setUiRestored(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uiRestored, incomingRoute, session.personas])

  // Persist UI state once the restore has completed.
  useEffect(() => {
    if (!uiRestored) return
    void AsyncStorage.setItem(
      CONSOLE_UI_KEY,
      JSON.stringify({ activeSection, activePersonaId })
    )
  }, [uiRestored, activeSection, activePersonaId])

  useEffect(() => {
    if (!uiRestored) return
    void AsyncStorage.setItem(CUSTOM_SURFACES_KEY, JSON.stringify(customSurfaces))
  }, [uiRestored, customSurfaces])

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [activeSection])

  useEffect(() => {
    if (activeSection === 'settings' && biometricEnabled) {
      setShowBiometricGate(true)
    }
  }, [activeSection, biometricEnabled])

  useEffect(() => {
    setRenameInput(session.verifiedDisplayName ?? session.displayName)
  }, [session.displayName, session.verifiedDisplayName])

  useEffect(() => {
    if (activePersonaId === PUBLIC_SLOT_ID) {
      // The "+ Public" slot is only valid while no public persona exists;
      // once one is created, switch to the real persona.
      const publicPersona = session.personas.find((p) => p.kind === 'public')
      if (publicPersona) setActivePersonaId(publicPersona.id)
      return
    }
    if (!session.personas.some((persona) => persona.id === activePersonaId)) {
      setActivePersonaId(session.personas[0]?.id ?? '')
    }
  }, [activePersonaId, session.personas])

  useEffect(() => {
    if (!incomingRoute) return
    switch (incomingRoute) {
      case 'verification':
        setShowIneModal(true)
        break
      case 'identity':
        setActiveSection('identity')
        break
      case 'settings':
        setActiveSection('settings')
        break
      case 'wallet':
        setActiveSection('identity')
        break
      default:
        setActiveSection('dashboard')
        break
    }
    onRouteHandled?.()
  }, [incomingRoute, onRouteHandled])

  const isPublicSlot = activePersonaId === PUBLIC_SLOT_ID

  const activePersona = useMemo(
    () =>
      isPublicSlot
        ? undefined
        : session.personas.find((p) => p.id === activePersonaId) ?? session.personas[0],
    [isPublicSlot, activePersonaId, session.personas]
  )

  const activeProofCount = session.proofArtifacts.filter((proof) => proof.status === 'Active').length
  const activeGrantCount = session.grants.filter((grant) => grant.status === 'Active').length

  async function completeVerification(record: IneVerificationRecord) {
    await onSaveIneVerification({ ...record, status: 'verified' })
    setShowIneModal(false)
    setActiveSection('dashboard')
  }

  async function saveNameAndUsePara() {
    const cleanName = renameInput.trim()
    if (!cleanName) return
    setSavingName(true)
    try {
      await onUpdateDisplayName(cleanName)
      setActiveSection('identity')
    } finally {
      setSavingName(false)
    }
  }

  async function requestParaStarterGrant() {
    setRequestingPara(true)
    try {
      await onRequestGrant({
        appId: 'para-civic-pass',
        appName: 'PARA Civic Pass',
        appKind: 'Civic app',
        surface: 'civic',
        requestedClaims: ['has_para_verification', 'is_civic_eligible'],
        audience: 'PARA civic actions',
        expiryPreference: '30 days',
        reason: 'Use the selected card in PARA with proof-only civic eligibility.',
        verifier: 'PARA verifier',
      })
      setActiveSection('dashboard')
    } finally {
      setRequestingPara(false)
    }
  }

  return (
    <>
      <StatusBar style="light" />
      <ConsoleLayout
        scrollRef={scrollRef}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true)
          void onRefreshSession().finally(() => setRefreshing(false))
        }}
        header={
          <ConsoleHeader
            notifications={notifications}
            badgeCount={badgeCount}
            hasDanger={hasDanger}
            personas={session.personas}
            activePersonaId={activePersonaId}
            onSelectPersona={setActivePersonaId}
            onDismissNotification={dismissNotification}
            onMarkNotificationsRead={markNotificationsRead}
          />
        }
        footer={
          <BottomNav
            activeSection={activeSection}
            onSectionChange={(id) => setActiveSection(id as ConsoleSectionId)}
          />
        }
      >
        {activeSection === 'dashboard' && (
          <HomeSection
            activePersona={activePersona ?? session.personas[0]}
            grants={session.grants}
            isVerified={isVerified}
            notifications={notifications}
            onApproveGrant={onApproveGrant}
            onApprovePolicyChange={onApprovePolicyChange}
            onApplyPolicyChange={onApplyPolicyChange}
            onDismissNotification={dismissNotification}
            onGoToIdentity={() => setActiveSection('identity')}
            onGoToPublic={() => {
              const publicPersona = session.personas.find((p) => p.kind === 'public')
              setActivePersonaId(publicPersona?.id ?? PUBLIC_SLOT_ID)
              setActiveSection('identity')
            }}
            onRejectPolicyChange={onRejectPolicyChange}
            onRevokeGrant={onRevokeGrant}
            pendingRequests={session.pendingRequests}
            session={session}
          />
        )}

        {activeSection === 'identity' && (
          <IdentitySection
            activeGrantCount={activeGrantCount}
            activePersona={activePersona}
            activeProofCount={activeProofCount}
            customSurfaces={customSurfaces}
            isVerified={isVerified}
            onSaveName={saveNameAndUsePara}
            onCreatePublicPersona={onCreatePublicPersona}
            onLinkPublicSocial={onLinkPublicSocial}
            onUnlinkPublicSocial={onUnlinkPublicSocial}
            onRequestParaGrant={requestParaStarterGrant}
            onShowSurfaceBuilder={() => setShowSurfaceBuilder(true)}
            onSkipRename={() => setActiveSection('dashboard')}
            onStartVerification={() => setShowIneModal(true)}
            onUpdateSurfaceState={onUpdateSurfaceState}
            proofArtifacts={session.proofArtifacts}
            publicSlotActive={isPublicSlot}
            renameInput={renameInput}
            renameStatus={renameStatus}
            requestingPara={requestingPara}
            savingName={savingName}
            session={session}
            setRenameInput={setRenameInput}
          />
        )}

        {activeSection === 'settings' && (
          <SettingsSection
            session={session}
            activePersona={activePersona}
            biometricEnabled={biometricEnabled}
            onSignOut={onSignOut}
            onToggleBiometric={(value) => {
              void toggleBiometric(value)
            }}
          />
        )}
      </ConsoleLayout>

      <SurfaceBuilderModal
        visible={showSurfaceBuilder}
        onClose={() => setShowSurfaceBuilder(false)}
        onCreate={(input) => {
          setCustomSurfaces((prev) => [...prev, input])
        }}
      />

      <IneVerificationModal
        visible={showIneModal}
        onClose={() => setShowIneModal(false)}
        onComplete={(record) => {
          void completeVerification(record)
        }}
        existingRecord={session.ineVerification}
      />

      <BiometricGateModal
        visible={showBiometricGate}
        onUnlock={() => {
          setShowBiometricGate(false)
          void unlock()
        }}
        onCancel={() => {
          setShowBiometricGate(false)
          setActiveSection('dashboard')
        }}
      />
    </>
  )
}
