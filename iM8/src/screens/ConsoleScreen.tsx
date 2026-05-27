import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
import { StatusPill } from '../components/m8/ConsolePrimitives'
import { tokens } from '../theme'
import type {
  GrantRequestInput,
  IdentitySession,
  IneVerificationRecord,
  NewSurfaceInput,
  RenameStatus,
} from '../types'
import { SafetySection } from './Console/sections/SafetySection'
import { IdentitySection } from './Console/sections/IdentitySection'
import { RequestsSection } from './Console/sections/RequestsSection'
import { ParaSection } from './Console/sections/ParaSection'
import { SettingsSheet } from '../components/m8/SettingsSheet'
import { hapticMedium } from '../utils/haptics'
import { getRenameStatus } from './Console/constants'
import { consoleStyles } from './Console/styles'

type ConsoleSectionId = 'identity' | 'requests' | 'para' | 'safety'

export function ConsoleScreen({
  onApproveGrant,
  onRequestGrant,
  onRevokeGrant,
  onSaveIneVerification,
  onSignOut,
  onUpdateDisplayName,
  session,
}: {
  onApproveGrant: (id: string) => Promise<void>
  onRequestGrant: (input: GrantRequestInput) => Promise<void>
  onRevokeGrant: (id: string) => Promise<void>
  onSaveIneVerification: (record: IneVerificationRecord) => Promise<void>
  onSignOut: () => void
  onUpdateDisplayName: (displayName: string) => Promise<void>
  session: IdentitySession
}) {
  const isVerified = session.ineVerification?.status === 'verified'
  const renameStatus = getRenameStatus(session, isVerified)
  const [activeSection, setActiveSection] = useState<ConsoleSectionId>(
    isVerified ? 'para' : 'identity'
  )
  const [activePersonaId, setActivePersonaId] = useState(session.personas[0]?.id ?? '')
  const [refreshing, setRefreshing] = useState(false)
  const [showSurfaceBuilder, setShowSurfaceBuilder] = useState(false)
  const [customSurfaces, setCustomSurfaces] = useState<NewSurfaceInput[]>([])
  const [showBiometricGate, setShowBiometricGate] = useState(false)
  const [showIneModal, setShowIneModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
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
  } = useNotificationEngine(session, () => setActiveSection('requests'))

  useEffect(() => {
    AsyncStorage.getItem('@m8/dark-mode').then((val) => {
      if (val === 'true') setDarkMode(true)
    })

  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [activeSection])

  useEffect(() => {
    if (activeSection === 'safety' && biometricEnabled) {
      setShowBiometricGate(true)
    }
  }, [activeSection, biometricEnabled])

  useEffect(() => {
    setRenameInput(session.verifiedDisplayName ?? session.displayName)
  }, [session.displayName, session.verifiedDisplayName])

  const activePersona = useMemo(
    () => session.personas.find((p) => p.id === activePersonaId) ?? session.personas[0],
    [activePersonaId, session.personas]
  )

  const activeProofCount = session.proofArtifacts.filter((proof) => proof.status === 'Active').length
  const activeGrantCount = session.grants.filter((grant) => grant.status === 'Active').length

  async function completeVerification(record: IneVerificationRecord) {
    await onSaveIneVerification({ ...record, status: 'verified' })
    setShowIneModal(false)
    setActiveSection('identity')
  }

  async function saveNameAndUsePara() {
    const cleanName = renameInput.trim()
    if (!cleanName) return
    setSavingName(true)
    try {
      await onUpdateDisplayName(cleanName)
      setActiveSection('para')
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
        reason: 'Use this identity in PARA with proof-only civic eligibility.',
        verifier: 'PARA verifier',
      })
      setActiveSection('requests')
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
            activeSection={activeSection}
            notifications={notifications}
            badgeCount={badgeCount}
            hasDanger={hasDanger}
            personas={session.personas}
            activePersonaId={activePersonaId}
            onSelectPersona={setActivePersonaId}
            onShowSettings={() => {
              hapticMedium()
              setShowSettings(true)
            }}
            onDismissNotification={dismissNotification}
          />
        }
        footer={
          <BottomNav
            activeSection={activeSection}
            onSectionChange={(id) => setActiveSection(id as ConsoleSectionId)}
          />
        }
      >
        <TopStatus
          badgeCount={badgeCount}
          hasDanger={hasDanger}
          isVerified={isVerified}
          renameStatus={renameStatus}
          session={session}
        />

        {activeSection === 'identity' && (
          <IdentitySection
            activeGrantCount={activeGrantCount}
            activePersona={activePersona}
            activeProofCount={activeProofCount}
            customSurfaces={customSurfaces}
            isVerified={isVerified}
            onSaveName={saveNameAndUsePara}
            onSelectPersona={setActivePersonaId}
            onShowSurfaceBuilder={() => setShowSurfaceBuilder(true)}
            onSkipRename={() => setActiveSection('para')}
            onStartVerification={() => setShowIneModal(true)}
            personas={session.personas}
            renameInput={renameInput}
            renameStatus={renameStatus}
            savingName={savingName}
            session={session}
            setRenameInput={setRenameInput}
          />
        )}

        {activeSection === 'requests' && (
          <RequestsSection
            grants={session.grants}
            notifications={notifications}
            onApprove={onApproveGrant}
            onDismissNotification={dismissNotification}
            onRevoke={onRevokeGrant}
            pendingRequests={session.pendingRequests}
          />
        )}

        {activeSection === 'para' && (
          <ParaSection
            isVerified={isVerified}
            onRequestParaGrant={requestParaStarterGrant}
            onStartVerification={() => setShowIneModal(true)}
            proofArtifacts={session.proofArtifacts}
            requestingPara={requestingPara}
            session={session}
          />
        )}

        {activeSection === 'safety' && (
          <SafetySection
            session={session}
            activePersona={activePersona}
            theme={tokens}
          />
        )}
      </ConsoleLayout>

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        darkMode={darkMode}
        onToggleDarkMode={(value) => {
          setDarkMode(value)
          void AsyncStorage.setItem('@m8/dark-mode', String(value))
        }}
        biometricEnabled={biometricEnabled}
        onToggleBiometric={(value) => {
          void toggleBiometric(value)
        }}
        onSignOut={onSignOut}
      />

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
          setActiveSection('identity')
        }}
      />
    </>
  )
}

function TopStatus({
  badgeCount,
  hasDanger,
  isVerified,
  renameStatus,
  session,
}: {
  badgeCount: number
  hasDanger: boolean
  isVerified: boolean
  renameStatus: RenameStatus
  session: IdentitySession
}) {
  return (
    <View style={consoleStyles.topStatus}>
      <View>
        <Text style={consoleStyles.appMark}>m8 identity</Text>
        <Text style={consoleStyles.screenTitle}>{session.verifiedDisplayName ?? session.displayName}</Text>
        <Text style={consoleStyles.screenSubtle}>{session.handle}</Text>
      </View>
      <View style={consoleStyles.statusPills}>
        <StatusPill
          label={isVerified ? 'Verified' : 'Private'}
          tone={isVerified ? 'success' : 'neutral'}
        />
        <StatusPill
          label={renameStatus === 'available' ? 'Name ready' : renameStatus === 'used' ? 'Named' : 'Rename locked'}
          tone={renameStatus === 'available' ? 'warning' : renameStatus === 'used' ? 'success' : 'neutral'}
        />
        {badgeCount > 0 ? (
          <StatusPill label={`${badgeCount} request${badgeCount > 1 ? 's' : ''}`} tone={hasDanger ? 'danger' : 'warning'} />
        ) : null}
      </View>
    </View>
  )
}
