import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated from 'react-native-reanimated'
import { ConsoleLayout } from './Console/ConsoleLayout'
import { BottomNav } from './Console/Nav'
import { useNotificationEngine, type NotificationItem } from '../hooks/useNotifications'
import { BiometricGateModal, useBiometricGate } from '../components/m8/BiometricGate'
import { IneVerificationModal } from '../components/m8/IneVerificationModal'
import { SurfaceBuilderModal } from '../components/m8/SurfaceBuilderModal'
import { Icon, type IconName } from '../components/m8/Icon'
import { buttonStyle, buttonTextStyle } from '../components/m8/Button'
import { cardStyle } from '../components/m8/Card'
import { tokens } from '../theme'
import type {
  AppGrant,
  ClaimRequest,
  GrantRequestInput,
  IdentitySession,
  IneVerificationRecord,
  NewSurfaceInput,
  Persona,
  ProofArtifact,
  RenameStatus,
  SurfaceId,
  SurfaceTemplate,
} from '../types'
import { SafetySection } from './Console/sections/SafetySection'

type ConsoleSectionId = 'identity' | 'requests' | 'para' | 'safety' | 'account'

const SURFACE_META: Record<SurfaceId, { label: string; color: string; icon: IconName }> = {
  public: { label: 'Public', color: tokens.success, icon: 'globe' },
  civic: { label: 'Civic', color: tokens.accent, icon: 'shieldCheck' },
  dating: { label: 'Dating', color: '#a78bfa', icon: 'personGroup' },
}

const CLAIM_LABELS: Record<string, string> = {
  is_verified_public_figure: 'Verified public figure',
  is_civic_eligible: 'Civic eligibility',
  has_para_verification: 'PARA verification',
  has_party_affiliation_match: 'Party affiliation match',
  is_age_eligible: 'Age eligible',
  has_backup_coverage: 'Backup coverage',
}

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
  const [renameInput, setRenameInput] = useState(session.verifiedDisplayName ?? session.displayName)
  const [savingName, setSavingName] = useState(false)
  const [requestingPara, setRequestingPara] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const scrollRef = useRef<Animated.ScrollView>(null)
  const { unlock } = useBiometricGate()

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
    AsyncStorage.getItem('@m8/biometric-enabled').then((val) => {
      if (val === 'true') setBiometricEnabled(true)
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

        {activeSection === 'account' && (
          <AccountSection
            biometricEnabled={biometricEnabled}
            darkMode={darkMode}
            onSignOut={onSignOut}
            onToggleBiometric={(value) => {
              setBiometricEnabled(value)
              void AsyncStorage.setItem('@m8/biometric-enabled', String(value))
            }}
            onToggleDarkMode={(value) => {
              setDarkMode(value)
              void AsyncStorage.setItem('@m8/dark-mode', String(value))
            }}
            session={session}
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
    <View style={styles.topStatus}>
      <View>
        <Text style={styles.appMark}>m8 identity</Text>
        <Text style={styles.screenTitle}>{session.verifiedDisplayName ?? session.displayName}</Text>
        <Text style={styles.screenSubtle}>{session.handle}</Text>
      </View>
      <View style={styles.statusPills}>
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

function IdentitySection({
  activeGrantCount,
  activePersona,
  activeProofCount,
  customSurfaces,
  isVerified,
  onSaveName,
  onSelectPersona,
  onShowSurfaceBuilder,
  onSkipRename,
  onStartVerification,
  personas,
  renameInput,
  renameStatus,
  savingName,
  session,
  setRenameInput,
}: {
  activeGrantCount: number
  activePersona: Persona | undefined
  activeProofCount: number
  customSurfaces: NewSurfaceInput[]
  isVerified: boolean
  onSaveName: () => Promise<void>
  onSelectPersona: (id: string) => void
  onShowSurfaceBuilder: () => void
  onSkipRename: () => void
  onStartVerification: () => void
  personas: Persona[]
  renameInput: string
  renameStatus: RenameStatus
  savingName: boolean
  session: IdentitySession
  setRenameInput: (value: string) => void
}) {
  const surfaces = [...session.surfaceTemplates, ...customSurfaces]

  return (
    <View style={styles.stack}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Critical flow</Text>
        <Text style={styles.heroTitle}>
          {isVerified ? 'Your identity can now use PARA.' : 'Verify once, then use PARA without exposing documents.'}
        </Text>
        <Text style={styles.heroBody}>
          {isVerified
            ? 'PARA-compatible apps can request proof receipts from this identity. You approve each one.'
            : 'Create is done. Verification is optional, but it unlocks PARA civic proofs and your public name choice.'}
        </Text>
        <ProgressRail isVerified={isVerified} renameStatus={renameStatus} />
        {!isVerified ? (
          <Pressable onPress={onStartVerification} style={[buttonStyle('primary'), styles.fullButton]}>
            <Text style={buttonTextStyle('primary')}>Verify identity</Text>
          </Pressable>
        ) : null}
      </View>

      {isVerified && renameStatus === 'available' ? (
        <View style={cardStyle('filled')}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Choose your public name</Text>
              <Text style={styles.sectionBody}>
                You can keep the private handle or save one verified display name for PARA.
              </Text>
            </View>
            <Icon name="pencil" size={22} color={tokens.accentSoft} />
          </View>
          <TextInput
            value={renameInput}
            onChangeText={setRenameInput}
            style={styles.input}
            placeholder="Public name"
            placeholderTextColor={tokens.muted}
          />
          <View style={styles.actionRow}>
            <Pressable onPress={onSkipRename} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>Keep private</Text>
            </Pressable>
            <Pressable onPress={() => void onSaveName()} style={buttonStyle('primary')}>
              {savingName ? (
                <ActivityIndicator color={tokens.onAccent} />
              ) : (
                <Text style={buttonTextStyle('primary')}>Save and use PARA</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.metricRow}>
        <Metric label="Proofs" value={String(activeProofCount)} />
        <Metric label="Apps" value={String(activeGrantCount)} />
        <Metric label="PARA" value={session.paraProvider.availability} />
      </View>

      <View style={styles.listBlock}>
        <SectionHeading title="Identity cards" detail="Tap a card to make it the working identity context." />
        {personas.map((persona) => (
          <PersonaCard
            key={persona.id}
            active={persona.id === activePersona?.id}
            onPress={() => onSelectPersona(persona.id)}
            persona={persona}
          />
        ))}
      </View>

      <View style={styles.listBlock}>
        <SectionHeading title="Surfaces" detail="Surfaces replace the old global switcher with clear sharing contexts." />
        {surfaces.map((surface) => (
          <SurfaceCard key={surface.id} surface={surface} />
        ))}
        <Pressable onPress={onShowSurfaceBuilder} style={[buttonStyle('secondary'), styles.fullButton]}>
          <Text style={buttonTextStyle('secondary')}>Create surface</Text>
        </Pressable>
      </View>
    </View>
  )
}

function RequestsSection({
  grants,
  notifications,
  onApprove,
  onDismissNotification,
  onRevoke,
  pendingRequests,
}: {
  grants: AppGrant[]
  notifications: NotificationItem[]
  onApprove: (id: string) => Promise<void>
  onDismissNotification: (id: string) => void
  onRevoke: (id: string) => Promise<void>
  pendingRequests: ClaimRequest[]
}) {
  return (
    <View style={styles.stack}>
      <SectionHero
        eyebrow="Requests"
        title={pendingRequests.length > 0 ? 'Apps are waiting for proof decisions.' : 'No proof requests need action.'}
        body="Requests, warnings, and grant receipts live here now instead of behind a tiny bell."
        icon="inbox"
      />

      {notifications.length > 0 ? (
        <View style={styles.listBlock}>
          <SectionHeading title="Inbox" detail="System notices and user notes." />
          {notifications.map((note) => (
            <NotificationCard
              key={note.id}
              notification={note}
              onDismissNotification={onDismissNotification}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.listBlock}>
        <SectionHeading title="Pending approvals" detail="Apps receive proofs only after you approve." />
        {pendingRequests.length > 0 ? (
          pendingRequests.map((request) => (
            <RequestCard key={request.id} request={request} onApprove={onApprove} />
          ))
        ) : (
          <EmptyCard icon="check" title="Nothing pending" body="New app requests will appear here with plain-language proof details." />
        )}
      </View>

      <View style={styles.listBlock}>
        <SectionHeading title="Grant receipts" detail="Every active or revoked permission stays visible." />
        {grants.map((grant) => (
          <GrantCard key={grant.id} grant={grant} onRevoke={onRevoke} />
        ))}
      </View>
    </View>
  )
}

function ParaSection({
  isVerified,
  onRequestParaGrant,
  onStartVerification,
  proofArtifacts,
  requestingPara,
  session,
}: {
  isVerified: boolean
  onRequestParaGrant: () => Promise<void>
  onStartVerification: () => void
  proofArtifacts: ProofArtifact[]
  requestingPara: boolean
  session: IdentitySession
}) {
  const activeProofs = proofArtifacts.filter((proof) => proof.status === 'Active')

  return (
    <View style={styles.stack}>
      <SectionHero
        eyebrow="PARA"
        title={isVerified ? 'PARA can use this identity.' : 'Verification unlocks PARA use.'}
        body={session.paraProvider.detail}
        icon="globe"
      />

      {!isVerified ? (
        <Pressable onPress={onStartVerification} style={[buttonStyle('primary'), styles.fullButton]}>
          <Text style={buttonTextStyle('primary')}>Verify before using PARA</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void onRequestParaGrant()}
          disabled={requestingPara}
          style={[buttonStyle('primary'), styles.fullButton, requestingPara && styles.disabled]}
        >
          {requestingPara ? (
            <ActivityIndicator color={tokens.onAccent} />
          ) : (
            <Text style={buttonTextStyle('primary')}>Start a PARA proof request</Text>
          )}
        </Pressable>
      )}

      <View style={styles.metricRow}>
        <Metric label="Provider" value={session.paraProvider.availability} />
        <Metric label="Policy" value={session.paraProvider.policyRecord} />
        <Metric label="Sync" value={session.paraProvider.lastSync} />
      </View>

      <View style={styles.listBlock}>
        <SectionHeading title="Proof receipts" detail="These are the receipts PARA-compatible apps can consume." />
        {activeProofs.length > 0 ? (
          activeProofs.map((proof) => <ProofCard key={proof.id} proof={proof} />)
        ) : (
          <EmptyCard icon="shield" title="No active proof receipts yet" body="Approve a request to create proof-only receipts for PARA and other apps." />
        )}
      </View>

      <View style={styles.listBlock}>
        <SectionHeading title="PARA claims" detail="Supported proofs for this identity." />
        {session.paraProvider.supportedClaims.map((claim) => (
          <SimpleRow
            key={claim}
            icon="check"
            title={CLAIM_LABELS[claim] ?? claim}
            detail="Available as proof-only output"
            meta="PARA"
          />
        ))}
      </View>

      <View style={styles.listBlock}>
        <SectionHeading title="Connected apps" detail="Apps that know how to ask m8 for bounded proofs." />
        {session.integrations.map((integration) => (
          <SimpleRow
            key={integration.id}
            icon="globe"
            title={integration.name}
            detail={integration.summary}
            meta={integration.status}
          />
        ))}
      </View>
    </View>
  )
}

function AccountSection({
  biometricEnabled,
  darkMode,
  onSignOut,
  onToggleBiometric,
  onToggleDarkMode,
  session,
}: {
  biometricEnabled: boolean
  darkMode: boolean
  onSignOut: () => void
  onToggleBiometric: (value: boolean) => void
  onToggleDarkMode: (value: boolean) => void
  session: IdentitySession
}) {
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  return (
    <View style={styles.stack}>
      <SectionHero
        eyebrow="Account"
        title="Settings moved here."
        body="The top-right gear is gone. Identity settings, device lock, and sign out now live in one labeled place."
        icon="settingsGear"
      />

      <View style={styles.listBlock}>
        <SectionHeading title="Device preferences" detail="Local controls for this app." />
        <ToggleRow
          icon="moon"
          label="Dark mode"
          value={darkMode}
          onPress={() => onToggleDarkMode(!darkMode)}
        />
        <ToggleRow
          icon="shieldCheck"
          label="Biometric lock"
          value={biometricEnabled}
          onPress={() => onToggleBiometric(!biometricEnabled)}
        />
      </View>

      <View style={styles.listBlock}>
        <SectionHeading title="Identity record" detail="Technical record for recovery and app compatibility." />
        <SimpleRow icon="person" title="Display name" detail={session.displayName} meta="Local" />
        <SimpleRow icon="shield" title="DID" detail={session.did} meta="Portable" />
        <SimpleRow icon="globe" title="Auth server" detail={session.authorizationServer} meta={session.brokerMode} />
      </View>

      <View style={cardStyle('danger')}>
        <Text style={styles.sectionTitle}>Sign out</Text>
        <Text style={styles.sectionBody}>
          This removes the local identity session from this device.
        </Text>
        {confirmSignOut ? (
          <View style={styles.actionRow}>
            <Pressable onPress={() => setConfirmSignOut(false)} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={buttonStyle('danger')}>
              <Text style={buttonTextStyle('danger')}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmSignOut(true)} style={[buttonStyle('danger'), styles.fullButton]}>
            <Text style={buttonTextStyle('danger')}>Sign out</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function ProgressRail({
  isVerified,
  renameStatus,
}: {
  isVerified: boolean
  renameStatus: RenameStatus
}) {
  const steps = [
    { label: 'Create', done: true },
    { label: 'Verify', done: isVerified },
    { label: 'Name', done: renameStatus === 'used' },
    { label: 'PARA', done: isVerified && renameStatus !== 'available' },
  ]

  return (
    <View style={styles.progressRail}>
      {steps.map((step) => (
        <View key={step.label} style={styles.progressStep}>
          <View style={[styles.progressDot, step.done && styles.progressDotDone]}>
            {step.done ? <Icon name="check" size={12} color={tokens.onAccent} /> : null}
          </View>
          <Text style={[styles.progressLabel, step.done && styles.progressLabelDone]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

function PersonaCard({
  active,
  onPress,
  persona,
}: {
  active: boolean
  onPress: () => void
  persona: Persona
}) {
  return (
    <Pressable onPress={onPress} style={[styles.personaCard, active && styles.personaCardActive]}>
      <View style={styles.rowBetween}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{persona.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <StatusPill label={active ? 'Active' : 'Card'} tone={active ? 'success' : 'neutral'} />
      </View>
      <Text style={styles.cardTitle}>{persona.name}</Text>
      <Text style={styles.cardMeta}>{persona.handle}</Text>
      <Text style={styles.cardBodyText}>{persona.oneLine}</Text>
      <View style={styles.surfaceStateRow}>
        {(Object.keys(SURFACE_META) as SurfaceId[]).map((surface) => (
          <View key={surface} style={styles.surfaceState}>
            <Text style={styles.surfaceStateLabel}>{SURFACE_META[surface].label}</Text>
            <Text style={styles.surfaceStateValue}>{persona.surfaceStates[surface]}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  )
}

function SurfaceCard({ surface }: { surface: SurfaceTemplate | NewSurfaceInput }) {
  const base = surface.id in SURFACE_META ? SURFACE_META[surface.id as SurfaceId] : null
  return (
    <View style={styles.surfaceCard}>
      <View style={[styles.surfaceIcon, { backgroundColor: (base?.color ?? tokens.accent) + '20' }]}>
        <Icon name={base?.icon ?? 'grid'} size={18} color={base?.color ?? tokens.accentSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{surface.name}</Text>
        <Text style={styles.rowDetail}>{surface.audience}</Text>
      </View>
      <Text style={styles.rowMeta}>{surface.status}</Text>
    </View>
  )
}

function RequestCard({
  onApprove,
  request,
}: {
  onApprove: (id: string) => Promise<void>
  request: ClaimRequest
}) {
  const [busy, setBusy] = useState(false)
  return (
    <View style={styles.receiptCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{request.appName}</Text>
        <StatusPill label={request.status} tone="warning" />
      </View>
      <Text style={styles.cardBodyText}>{request.reason}</Text>
      <ClaimChips claims={request.requestedClaims} />
      <Pressable
        onPress={async () => {
          setBusy(true)
          try {
            await onApprove(request.id)
          } finally {
            setBusy(false)
          }
        }}
        disabled={busy}
        style={[buttonStyle('primary'), styles.fullButton, busy && styles.disabled]}
      >
        {busy ? (
          <ActivityIndicator color={tokens.onAccent} />
        ) : (
          <Text style={buttonTextStyle('primary')}>Approve proof request</Text>
        )}
      </Pressable>
    </View>
  )
}

function GrantCard({
  grant,
  onRevoke,
}: {
  grant: AppGrant
  onRevoke: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const active = grant.status === 'Active'
  return (
    <View style={styles.receiptCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{grant.appName}</Text>
        <StatusPill label={grant.status} tone={active ? 'success' : 'neutral'} />
      </View>
      <Text style={styles.cardBodyText}>{grant.reason}</Text>
      <ClaimChips claims={grant.requestedClaims} />
      {active ? (
        <Pressable
          onPress={async () => {
            setBusy(true)
            try {
              await onRevoke(grant.id)
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
          style={[buttonStyle('secondary'), styles.fullButton, busy && styles.disabled]}
        >
          <Text style={buttonTextStyle('secondary')}>{busy ? 'Revoking...' : 'Revoke grant'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function ProofCard({ proof }: { proof: ProofArtifact }) {
  return (
    <View style={styles.receiptCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{CLAIM_LABELS[proof.claimType] ?? proof.label}</Text>
        <StatusPill label={proof.status} tone={proof.status === 'Active' ? 'success' : 'neutral'} />
      </View>
      <Text style={styles.cardBodyText}>{proof.summary}</Text>
      <SimpleFact label="Issuer" value={proof.issuer} />
      <SimpleFact label="Audience" value={proof.audienceAppId} />
      <SimpleFact label="Expires" value={proof.expiresAt} />
    </View>
  )
}

function NotificationCard({
  notification,
  onDismissNotification,
}: {
  notification: NotificationItem
  onDismissNotification: (id: string) => void
}) {
  return (
    <View style={styles.notificationCard}>
      <Icon name={notification.icon} size={18} color={toneColor(notification.severity)} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{notification.title}</Text>
        {notification.body ? <Text style={styles.rowDetail}>{notification.body}</Text> : null}
        <Text style={styles.rowMeta}>{notification.time}</Text>
      </View>
      {notification.action ? (
        <Pressable onPress={notification.action.onPress} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>{notification.action.label}</Text>
        </Pressable>
      ) : null}
      {notification.source === 'user' ? (
        <Pressable onPress={() => onDismissNotification(notification.id)} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function SectionHero({
  body,
  eyebrow,
  icon,
  title,
}: {
  body: string
  eyebrow: string
  icon: IconName
  title: string
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroIcon}>
        <Icon name={icon} size={24} color={tokens.accentSoft} />
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroBody}>{body}</Text>
    </View>
  )
}

function SectionHeading({ detail, title }: { detail: string; title: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{detail}</Text>
    </View>
  )
}

function SimpleRow({
  detail,
  icon,
  meta,
  title,
}: {
  detail: string
  icon: IconName
  meta: string
  title: string
}) {
  return (
    <View style={styles.simpleRow}>
      <Icon name={icon} size={18} color={tokens.accentSoft} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Text style={styles.rowMeta}>{meta}</Text>
    </View>
  )
}

function ToggleRow({
  icon,
  label,
  onPress,
  value,
}: {
  icon: IconName
  label: string
  onPress: () => void
  value: boolean
}) {
  return (
    <Pressable onPress={onPress} style={styles.simpleRow}>
      <Icon name={icon} size={18} color={tokens.accentSoft} />
      <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </View>
    </Pressable>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return (
    <View style={[styles.statusPill, { borderColor: toneColor(tone) + '60', backgroundColor: toneColor(tone) + '15' }]}>
      <Text style={[styles.statusPillText, { color: toneColor(tone) }]}>{label}</Text>
    </View>
  )
}

function ClaimChips({ claims }: { claims: string[] }) {
  return (
    <View style={styles.claimRow}>
      {claims.map((claim) => (
        <View key={claim} style={styles.claimChip}>
          <Text style={styles.claimText}>{CLAIM_LABELS[claim] ?? claim}</Text>
        </View>
      ))}
    </View>
  )
}

function SimpleFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  )
}

function EmptyCard({
  body,
  icon,
  title,
}: {
  body: string
  icon: IconName
  title: string
}) {
  return (
    <View style={styles.emptyCard}>
      <Icon name={icon} size={28} color={tokens.muted} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBodyText}>{body}</Text>
    </View>
  )
}

function getRenameStatus(session: IdentitySession, isVerified: boolean): RenameStatus {
  if (session.renameStatus) return session.renameStatus
  return isVerified ? 'available' : 'locked'
}

function toneColor(tone: string) {
  if (tone === 'success') return tokens.success
  if (tone === 'warning') return tokens.warning
  if (tone === 'danger') return tokens.danger
  return tokens.muted
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  topStatus: {
    gap: 12,
  },
  appMark: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  screenTitle: {
    color: tokens.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
  },
  screenSubtle: {
    color: tokens.muted,
    fontSize: 13,
    marginTop: 2,
  },
  statusPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroCard: {
    ...cardStyle('accent'),
    borderRadius: 18,
    padding: 18,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surfaceTransparent,
    marginBottom: 4,
  },
  eyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: tokens.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  heroBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  progressRail: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  progressStep: {
    flex: 1,
    gap: 6,
    alignItems: 'center',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: tokens.accent,
    borderColor: tokens.accent,
  },
  progressLabel: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  progressLabelDone: {
    color: tokens.text,
  },
  fullButton: {
    marginTop: 10,
    minHeight: 46,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  metricLabel: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
  },
  listBlock: {
    gap: 8,
  },
  sectionTitle: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionBody: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surfaceRaised,
    color: tokens.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginTop: 8,
  },
  personaCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
    gap: 8,
  },
  personaCardActive: {
    borderColor: tokens.accentBorder,
    backgroundColor: tokens.accentTransparent,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: tokens.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardMeta: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  cardBodyText: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  surfaceStateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  surfaceState: {
    flex: 1,
    borderRadius: 12,
    padding: 8,
    backgroundColor: tokens.surfaceTransparent,
  },
  surfaceStateLabel: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  surfaceStateValue: {
    color: tokens.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  surfaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 13,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  surfaceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 13,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 13,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  rowTitle: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rowDetail: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  rowMeta: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: 92,
  },
  textButton: {
    paddingVertical: 4,
  },
  textButtonLabel: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  claimRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  claimChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: tokens.surfaceTransparent,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  claimText: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  factLabel: {
    color: tokens.muted,
    fontSize: 12,
  },
  factValue: {
    color: tokens.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 18,
    gap: 8,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 3,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  toggleActive: {
    backgroundColor: tokens.accent,
    borderColor: tokens.accent,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: tokens.muted,
  },
  toggleThumbActive: {
    transform: [{ translateX: 19 }],
    backgroundColor: tokens.onAccent,
  },
  disabled: {
    opacity: 0.5,
  },
})
