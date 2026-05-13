import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { BiometricGateModal, useBiometricGate } from '../components/m8/BiometricGate'
import { IneVerificationModal } from '../components/m8/IneVerificationModal'
import { QrExportModal } from '../components/m8/QrExportModal'
import { SurfaceBuilderModal } from '../components/m8/SurfaceBuilderModal'
import InfoTooltip from '../components/m8/InfoTooltip'
import { sectionTitle, surfaces } from '../poc-data'
import { tokens } from '../theme'
import {
  type AppGrant,
  type ClaimRequest,
  type ConsentLedgerEntry,
  type GrantRequestInput,
  type IdentitySession,
  type IneVerificationRecord,
  type Integration,
  type NewSurfaceInput,
  type Persona,
  type PolicyNode,
  type PolicyEdge,
  type KnowledgeBundle,
  type PermissionedSpace,
  type ProofArtifact,
  type SafetyAction,
  type SectionId,
  type SignalProvider,
  type SurfaceId,
  type SurfaceTemplate,
} from '../types'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Section imports
import { HomeSection } from './Console/sections/HomeSection'
import { GrantsSection } from './Console/sections/GrantsSection'
import { CivicSection } from './Console/sections/CivicSection'
import { ProvidersSection } from './Console/sections/ProvidersSection'
import { SafetySection } from './Console/sections/SafetySection'
import { MyBaseSection } from './Console/sections/MyBaseSection'

type NavSectionId = SectionId | 'mybase'

const SECTIONS: { id: NavSectionId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'grants', label: 'Grants', icon: '🔑' },
  { id: 'civic', label: 'Civic', icon: '🇲🇽' },
  { id: 'mybase', label: 'MyBase', icon: '🧠' },
  { id: 'providers', label: 'Providers', icon: '⚙️' },
  { id: 'safety', label: 'Safety', icon: '🛡️' },
]

export function ConsoleScreen({
  onApproveGrant,
  onRequestGrant,
  onRevokeGrant,
  onSignOut,
  session,
}: {
  onApproveGrant: (id: string) => Promise<void>
  onRequestGrant: (input: GrantRequestInput) => Promise<void>
  onRevokeGrant: (id: string) => Promise<void>
  onSignOut: () => void
  session: IdentitySession
}) {
  const [activeSurface, setActiveSurface] = useState<SurfaceId>('public')
  const [activePersonaId, setActivePersonaId] = useState(session.personas[0]?.id ?? '')
  const [activeSection, setActiveSection] = useState<NavSectionId>('home')
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [selectedGrantId, setSelectedGrantId] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showSurfaceBuilder, setShowSurfaceBuilder] = useState(false)
  const [customSurfaces, setCustomSurfaces] = useState<NewSurfaceInput[]>([])
  const [showBiometricGate, setShowBiometricGate] = useState(false)
  const { isLocked, isAuthenticating, unlock } = useBiometricGate()
  const [showIneModal, setShowIneModal] = useState(false)
  const [ineRecord, setIneRecord] = useState<IneVerificationRecord | undefined>(undefined)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrPersona, setQrPersona] = useState<Persona | undefined>(undefined)
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [grantRequest, setGrantRequest] = useState<{appName: string; claim: string; surface: string} | undefined>(undefined)
  const [notifications, setNotifications] = useState<{id: string; emoji: string; title: string; time: string}[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  // Load dark mode
  useEffect(() => {
    AsyncStorage.getItem('@m8/dark-mode').then((val) => {
      if (val === 'true') setDarkMode(true)
    })
  }, [])

  // Lock when switching to safety section
  useEffect(() => {
    if (activeSection === 'safety') {
      setShowBiometricGate(true)
    }
  }, [activeSection])

  function addNotification(emoji: string, title: string) {
    setNotifications((prev) => [{ id: `${Date.now()}`, emoji, title, time: 'Just now' }, ...prev].slice(0, 50))
  }

  const activePersona = useMemo(
    () => session.personas.find((p) => p.id === activePersonaId) ?? session.personas[0],
    [activePersonaId, session.personas]
  )

  const visibleRequests = useMemo(
    () => session.pendingRequests.filter((r) => r.surface === activeSurface),
    [activeSurface, session.pendingRequests]
  )

  const visibleGrants = useMemo(
    () => session.grants.filter((g) => g.surface === activeSurface),
    [activeSurface, session.grants]
  )

  const visibleProviders = useMemo(
    () => session.providers.filter((p) => p.surfaces.includes(activeSurface)),
    [activeSurface, session.providers]
  )

  const visibleApps = useMemo(
    () => session.integrations.filter((i) => i.surfaces.includes(activeSurface)),
    [activeSurface, session.integrations]
  )

  const selectedRequest = visibleRequests.find((r) => r.id === selectedRequestId) ?? null
  const selectedGrant = visibleGrants.find((g) => g.id === selectedGrantId) ?? null
  const selectedArtifacts = selectedGrant
    ? session.proofArtifacts.filter((a) => selectedGrant.proofArtifactIds.includes(a.id))
    : []

  const activeGrantCount = session.grants.filter((g) => g.status === 'Active').length
  const pendingGrantCount = session.pendingRequests.length
  const revokedGrantCount = session.grants.filter((g) => g.status === 'Revoked').length
  const expiredProofCount = session.proofArtifacts.filter((a) => a.status === 'Expired').length
  const paraIsDegraded = session.paraProvider.availability === 'Degraded'

  const surfaceColor: Record<SurfaceId, string> = {
    public: tokens.success,
    civic: tokens.accent,
    dating: '#a78bfa',
  }

  const theme = tokens // dark mode stub

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                setTimeout(() => setRefreshing(false), 1500)
              }}
              tintColor={tokens.accent}
            />
          }
        >
          {/* Persona Header */}
          <View style={[styles.personaHeader, { borderColor: surfaceColor[activeSurface] + '40' }]}>
            {/* Top bar: dark mode + notifications */}
            <View style={styles.headerTopBar}>
              <Pressable
                onPress={async () => {
                  const next = !darkMode
                  setDarkMode(next)
                  await AsyncStorage.setItem('@m8/dark-mode', String(next))
                }}
                style={styles.iconButton}
              >
                <Text style={{ fontSize: 20 }}>{darkMode ? '☀️' : '🌙'}</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowNotifications(!showNotifications)}
                style={styles.iconButton}
              >
                <Text style={{ fontSize: 20 }}>🔔</Text>
                {notifications.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{notifications.length}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Notifications dropdown */}
            {showNotifications && (
              <View style={[styles.notificationsPanel, { backgroundColor: theme.surfaceRaised }]}>
                {notifications.length === 0 ? (
                  <Text style={[styles.emptyNote, { color: theme.muted }]}>No notifications yet</Text>
                ) : (
                  notifications.map((n) => (
                    <View key={n.id} style={styles.noteRow}>
                      <Text style={{ fontSize: 16 }}>{n.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.noteTitle, { color: theme.text }]}>{n.title}</Text>
                        <Text style={[styles.noteTime, { color: theme.muted }]}>{n.time}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Persona Switcher */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.personaSwitcher}
            >
              {session.personas.map((p) => {
                const isActive = p.id === activePersonaId
                const pColor = surfaceColor[activeSurface]
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setActivePersonaId(p.id)}
                    style={[
                      styles.personaChip,
                      isActive && { borderColor: pColor, backgroundColor: pColor + '18' },
                    ]}
                  >
                    <View style={[styles.personaChipAvatar, { backgroundColor: pColor + '25' }]}>
                      <Text style={[styles.personaChipAvatarText, { color: pColor }]}>
                        {p.name[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.personaChipText}>
                      <Text style={[styles.personaChipName, isActive && { color: pColor, fontWeight: '800' }]}>
                        {p.name}
                      </Text>
                      <Text style={styles.personaChipRole}>{p.role}</Text>
                    </View>
                    {isActive && <View style={[styles.personaChipActiveDot, { backgroundColor: pColor }]} />}
                  </Pressable>
                )
              })}
              <Pressable
                onPress={() => { setQrPersona(activePersona); setShowQrModal(true) }}
                style={styles.personaChip}
              >
                <View style={[styles.personaChipAvatar, { backgroundColor: theme.surfaceRaised }]}>
                  <Text style={{ fontSize: 18 }}>📤</Text>
                </View>
                <Text style={[styles.personaChipName, { fontSize: 12 }]}>Export</Text>
              </Pressable>
            </ScrollView>

            {/* Active Persona Detail */}
            <View style={styles.personaRow}>
              <View style={[styles.avatar, { backgroundColor: surfaceColor[activeSurface] + '30' }]}>
                <Text style={[styles.avatarText, { color: surfaceColor[activeSurface] }]}>
                  {(activePersona?.name[0] ?? 'M').toUpperCase()}
                </Text>
              </View>
              <View style={styles.personaText}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.personaName, { color: theme.text }]}>{activePersona?.name ?? 'Unknown'}</Text>
                  {ineRecord?.status === 'verified' && (
                    <View style={styles.ineBadge}>
                      <Text style={styles.ineBadgeText}>🇲🇽 Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.personaHandle, { color: theme.accentSoft }]}>@{session.handle}</Text>
                <Text style={[styles.personaRole, { color: theme.muted }]}>{activePersona?.role ?? ''}</Text>
              </View>
            </View>

            {/* Surface Switcher */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.surfaceRow}>
              {surfaces.map((s) => {
                const isActive = s.id === activeSurface
                const state = activePersona?.surfaceStates[s.id] ?? 'Muted'
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setActiveSurface(s.id)}
                    style={[
                      styles.surfaceChip,
                      isActive && { backgroundColor: surfaceColor[s.id] + '20', borderColor: surfaceColor[s.id] },
                    ]}
                  >
                    <View style={[styles.surfaceDot, { backgroundColor: surfaceColor[s.id] }]} />
                    <Text style={[styles.surfaceChipText, isActive && { color: surfaceColor[s.id], fontWeight: '800' }]}>
                      {s.label}
                    </Text>
                    <Text style={[styles.surfaceState, { color: surfaceColor[s.id] + 'aa' }]}>{state}</Text>
                  </Pressable>
                )
              })}
              {customSurfaces.map((cs) => {
                const csId = cs.id as SurfaceId
                const isActive = csId === activeSurface
                const csColor = tokens.accentSoft
                return (
                  <Pressable
                    key={cs.id}
                    onPress={() => setActiveSurface(csId)}
                    style={[
                      styles.surfaceChip,
                      isActive && { backgroundColor: csColor + '20', borderColor: csColor },
                    ]}
                  >
                    <View style={[styles.surfaceDot, { backgroundColor: csColor }]} />
                    <Text style={[styles.surfaceChipText, isActive && { color: csColor, fontWeight: '800' }]}>
                      {cs.name}
                    </Text>
                    <Text style={[styles.surfaceState, { color: csColor + 'aa' }]}>{cs.status}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.statRow}>
              <MiniStat label="Active" value={String(activeGrantCount)} />
              <MiniStat label="Pending" value={String(pendingGrantCount)} />
              <MiniStat label="Proofs" value={String(session.proofArtifacts.length)} />
              <MiniStat label="Safety" value={session.pdsSafety.state} tone={
                session.pdsSafety.state === 'Backed up' ? 'success'
                : session.pdsSafety.state === 'Needs attention' ? 'warning'
                : 'danger'
              } />
            </View>
          </View>

          {/* Surface Builder Modal */}
          <SurfaceBuilderModal
            visible={showSurfaceBuilder}
            onClose={() => setShowSurfaceBuilder(false)}
            onCreate={(input: NewSurfaceInput) => {
              const newSurface: SurfaceTemplate = {
                id: `custom-${Date.now()}`,
                name: input.name,
                audience: input.audience,
                status: 'Draft',
                traits: input.traits,
              }
              setCustomSurfaces((prev: NewSurfaceInput[]) => [...prev, newSurface as NewSurfaceInput])
            }}
          />

          {/* INE Verification Modal */}
          <IneVerificationModal
            visible={showIneModal}
            onClose={() => setShowIneModal(false)}
            onComplete={(record) => {
              setIneRecord(record)
              setShowIneModal(false)
            }}
            existingRecord={ineRecord}
          />

          {/* QR Export Modal */}
          <QrExportModal
            visible={showQrModal}
            onClose={() => setShowQrModal(false)}
            persona={qrPersona}
            did={session.did}
          />

          {/* Biometric Gate */}
          <BiometricGateModal
            visible={showBiometricGate}
            onUnlock={() => {
              setShowBiometricGate(false)
              void unlock()
            }}
            onCancel={() => {
              setShowBiometricGate(false)
              setActiveSection('home')
            }}
          />

          {/* Composite Status Banner */}
          {(() => {
            if (revokedGrantCount > 0) {
              return (
                <StatusBanner
                  tone="danger"
                  title={`${revokedGrantCount} revoked grant${revokedGrantCount > 1 ? 's' : ''}`}
                  detail="Revoked grants remain visible for audit, but linked proofs are marked inactive."
                  action={{ label: 'Review', onPress: () => setActiveSection('grants') }}
                />
              )
            }
            if (expiredProofCount > 0) {
              return (
                <StatusBanner
                  tone="warning"
                  title={`${expiredProofCount} expired proof${expiredProofCount > 1 ? 's' : ''}`}
                  detail="Expired proofs stay in history, but they are no longer treated as active access."
                  action={{ label: 'Review', onPress: () => setActiveSection('grants') }}
                />
              )
            }
            if (paraIsDegraded) {
              return (
                <StatusBanner
                  tone="warning"
                  title="PARA is degraded"
                  detail="Verification still shows up here, but claim refreshes may need manual review until PARA is healthy again."
                />
              )
            }
            return null
          })()}

          {/* Section Heading */}
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.contentTitle, { color: theme.text }]}>{sectionTitle(activeSection)}</Text>
            {activeSection === 'home' && (
              <Pressable
                onPress={() => setShowSurfaceBuilder(true)}
                style={[styles.sectionCta, { backgroundColor: theme.surfaceRaised, borderColor: theme.stroke }]}
              >
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>+ Surface</Text>
              </Pressable>
            )}
          </View>

          {/* Sections */}
          {activeSection === 'home' && (
            <HomeSection
              session={session}
              activeSurface={activeSurface}
              activePersona={activePersona}
              visibleRequests={visibleRequests}
              commands={session.commands[activeSurface] ?? []}
              customSurfaces={customSurfaces}
              onRequestGrant={onRequestGrant}
              onShowSurfaceBuilder={() => setShowSurfaceBuilder(true)}
              theme={theme}
            />
          )}

          {activeSection === 'grants' && (
            <GrantsSection
              visibleRequests={visibleRequests}
              visibleGrants={visibleGrants}
              selectedRequest={selectedRequest}
              selectedGrant={selectedGrant}
              selectedArtifacts={selectedArtifacts}
              onSelectRequest={setSelectedRequestId}
              onSelectGrant={setSelectedGrantId}
              onApprove={onApproveGrant}
              onRevoke={onRevokeGrant}
              theme={theme}
            />
          )}

          {activeSection === 'civic' && (
            <CivicSection
              ineRecord={ineRecord}
              onStartVerification={() => setShowIneModal(true)}
              onViewProofs={() => setShowIneModal(true)}
              onRequestGrant={(appName, claim) => {
                setGrantRequest({ appName, claim, surface: activeSurface })
                setShowGrantModal(true)
              }}
              theme={theme}
            />
          )}

          {activeSection === 'mybase' && (
            <MyBaseSection
              sessionDid={session.did}
              proofArtifacts={session.proofArtifacts}
              theme={theme}
              addNotification={addNotification}
            />
          )}

          {activeSection === 'providers' && (
            <ProvidersSection
              session={session}
              visibleApps={visibleApps}
              visibleProviders={visibleProviders}
              theme={theme}
            />
          )}

          {activeSection === 'safety' && (
            <SafetySection
              session={session}
              activePersona={activePersona}
              theme={theme}
            />
          )}
        </ScrollView>

        {/* Bottom Nav */}
        <View style={styles.bottomNav}>
          {SECTIONS.map((section) => {
            const selected = section.id === activeSection
            return (
              <Pressable
                key={section.id}
                onPress={() => setActiveSection(section.id as NavSectionId)}
                style={styles.bottomNavItem}
              >
                <Text style={[styles.bottomNavIcon, selected && { opacity: 1 }]}>{section.icon}</Text>
                <Text style={[styles.bottomNavText, selected && styles.bottomNavTextActive]}>
                  {section.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </SafeAreaView>
  )
}

/* ─── Shared Components ─── */

function StatusBanner({ detail, title, tone, action }: { detail: string; title: string; tone: 'warning' | 'danger'; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={[styles.banner, tone === 'warning' ? styles.bannerWarning : styles.bannerDanger]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerEyebrow, { color: tone === 'warning' ? tokens.warning : tokens.danger }]}>
            {title}
          </Text>
          <Text style={styles.bannerDetail}>{detail}</Text>
        </View>
        {action && (
          <Pressable onPress={action.onPress} style={styles.bannerAction}>
            <Text style={{ color: tone === 'warning' ? tokens.warning : tokens.danger, fontSize: 12, fontWeight: '700' }}>
              {action.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneColor = tone === 'success' ? tokens.success : tone === 'warning' ? tokens.warning : tone === 'danger' ? tokens.danger : tokens.text
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={[styles.miniStatValue, { color: toneColor }]}>{value}</Text>
    </View>
  )
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  shell: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  personaHeader: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    gap: 14,
  },
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
  },
  personaText: {
    flex: 1,
  },
  personaName: {
    color: tokens.text,
    fontSize: 22,
    fontWeight: '800',
  },
  personaHandle: {
    color: tokens.accentSoft,
    fontSize: 13,
    marginTop: 2,
  },
  personaRole: {
    color: tokens.muted,
    fontSize: 13,
    marginTop: 4,
  },
  ineBadge: {
    backgroundColor: tokens.success + '20',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: tokens.success + '40',
  },
  ineBadgeText: {
    color: tokens.success,
    fontSize: 11,
    fontWeight: '700',
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginBottom: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: tokens.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  notificationsPanel: {
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  emptyNote: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  noteTime: {
    fontSize: 11,
    marginTop: 2,
  },
  personaSwitcher: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  personaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
    minWidth: 120,
  },
  personaChipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaChipAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  personaChipText: {
    flex: 1,
  },
  personaChipName: {
    color: tokens.text,
    fontSize: 13,
    fontWeight: '700',
  },
  personaChipRole: {
    color: tokens.muted,
    fontSize: 11,
    marginTop: 2,
  },
  personaChipActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  surfaceRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  surfaceChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  surfaceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  surfaceChipText: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  surfaceState: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  miniStat: {
    flex: 1,
    minWidth: 72,
    borderRadius: 16,
    padding: 12,
    backgroundColor: tokens.surfaceTransparent,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  miniStatLabel: {
    color: tokens.muted,
    fontSize: 11,
  },
  miniStatValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  contentTitle: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionCta: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  banner: {
    borderRadius: 18,
    padding: 14,
    gap: 6,
    marginTop: 12,
  },
  bannerWarning: {
    backgroundColor: tokens.warning + '15',
    borderWidth: 1,
    borderColor: tokens.warning + '40',
  },
  bannerDanger: {
    backgroundColor: tokens.danger + '15',
    borderWidth: 1,
    borderColor: tokens.danger + '40',
  },
  bannerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bannerDetail: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerAction: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: tokens.surfaceRaised,
    marginLeft: 10,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surface,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bottomNavIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  bottomNavText: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  bottomNavTextActive: {
    color: tokens.text,
    fontWeight: '700',
  },
})
