import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated from 'react-native-reanimated'
import { ConsoleLayout } from './Console/ConsoleLayout'
import { ConsoleHeader } from './Console/Header'
import { BottomNav } from './Console/Nav'
import { useNotificationEngine } from '../hooks/useNotifications'
import { BiometricGateModal, useBiometricGate } from '../components/m8/BiometricGate'
import { IneVerificationModal } from '../components/m8/IneVerificationModal'
import { SurfaceBuilderModal } from '../components/m8/SurfaceBuilderModal'
import type {
  GrantRequestInput,
  IdentitySession,
  IneVerificationRecord,
  NewSurfaceInput,
  SocialProvider,
} from '../types'
import { SettingsSection } from './Console/sections/SafetySection'
import { HomeSection } from './Console/sections/HomeSection'
import { IdentitySection } from './Console/sections/IdentitySection'
import { getRenameStatus } from './Console/constants'

type ConsoleSectionId = 'dashboard' | 'identity' | 'settings'

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
  session,
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
  session: IdentitySession
}) {
  const isVerified = session.ineVerification?.status === 'verified'
  const renameStatus = getRenameStatus(session, isVerified)
  const [activeSection, setActiveSection] = useState<ConsoleSectionId>('dashboard')
  const [activePersonaId, setActivePersonaId] = useState(session.personas[0]?.id ?? '')
  const [refreshing, setRefreshing] = useState(false)
  const [showSurfaceBuilder, setShowSurfaceBuilder] = useState(false)
  const [customSurfaces, setCustomSurfaces] = useState<NewSurfaceInput[]>([])
  const [showBiometricGate, setShowBiometricGate] = useState(false)
  const [showIneModal, setShowIneModal] = useState(false)
  const [renameInput, setRenameInput] = useState(session.verifiedDisplayName ?? session.displayName)
  const [savingName, setSavingName] = useState(false)
  const [requestingPara, setRequestingPara] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const scrollRef = useRef<Animated.ScrollView>(null)
  const { unlock, enabled: biometricEnabled, toggleEnabled: toggleBiometric } = useBiometricGate()

  const {
    notifications,
    badgeCount,
    hasDanger,
    dismissNotification,
    markNotificationsRead,
  } = useNotificationEngine(session, () => setActiveSection('dashboard'))

  useEffect(() => {
    AsyncStorage.getItem('@m8/dark-mode').then((val) => {
      if (val === 'true') setDarkMode(true)
    })

  }, [])

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
    if (!session.personas.some((persona) => persona.id === activePersonaId)) {
      setActivePersonaId(session.personas[0]?.id ?? '')
    }
  }, [activePersonaId, session.personas])

  const activePersona = useMemo(
    () => session.personas.find((p) => p.id === activePersonaId) ?? session.personas[0],
    [activePersonaId, session.personas]
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
          setTimeout(() => setRefreshing(false), 900)
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
            activePersona={activePersona}
            grants={session.grants}
            isVerified={isVerified}
            notifications={notifications}
            onApproveGrant={onApproveGrant}
            onDismissNotification={dismissNotification}
            onGoToIdentity={() => setActiveSection('identity')}
            onGoToSettings={() => setActiveSection('settings')}
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
            onApprovePolicyChange={onApprovePolicyChange}
            onApplyPolicyChange={onApplyPolicyChange}
            onRejectPolicyChange={onRejectPolicyChange}
            onRequestParaGrant={requestParaStarterGrant}
            onSelectPersona={setActivePersonaId}
            onShowSurfaceBuilder={() => setShowSurfaceBuilder(true)}
            onSkipRename={() => setActiveSection('identity')}
            onStartVerification={() => setShowIneModal(true)}
            personas={session.personas}
            proofArtifacts={session.proofArtifacts}
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
            darkMode={darkMode}
            onLinkPublicSocial={onLinkPublicSocial}
            onSignOut={onSignOut}
            onToggleBiometric={(value) => {
              void toggleBiometric(value)
            }}
            onToggleDarkMode={(value) => {
              setDarkMode(value)
              void AsyncStorage.setItem('@m8/dark-mode', String(value))
            }}
            onUnlinkPublicSocial={onUnlinkPublicSocial}
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
