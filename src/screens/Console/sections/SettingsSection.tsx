import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Clipboard from 'expo-clipboard'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { EmptyState, consoleStyles } from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { RecoveryPhraseSheet } from '../../../components/m8/RecoveryPhraseSheet'
import { RestoreIdentitySheet } from '../../../components/m8/RestoreIdentitySheet'
import { getBackupState, type BackupState } from '../../../services/seedVault'
import { copyText } from '../../../services/clipboard'
import { describeLastSeen } from '../../../services/deviceRegistry'
import { useDeviceRegistry } from '../../../hooks/useDeviceRegistry'
import { getBiometricLockEnabled } from '../../../components/m8/BiometricGate'
import { visibilityDestinationLabel } from '../../../contracts/profileFacets'
import type { DeviceRecord, IdentitySession, Persona, ConsentLedgerEntry, Visibility } from '../../../types'
import { tokens } from '../../../theme'
import { hapticLight, hapticMedium } from '../../../utils/haptics'

export function SettingsSection({
  session,
  activePersona,
  biometricEnabled,
  onSignOut,
  onToggleBiometric,
  onUpdateSignalVisibility,
}: {
  session: IdentitySession
  activePersona: Persona | undefined
  biometricEnabled: boolean
  onSignOut: () => void
  onToggleBiometric: (value: boolean) => void
  onUpdateSignalVisibility: (personaId: string, signalLabel: string, visibility: Visibility) => Promise<void>
}) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false)
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false)
  const [showPhrase, setShowPhrase] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [backup, setBackup] = useState<BackupState>('none')
  const { devices, currentId, removeDevice, recordRestore } = useDeviceRegistry()

  const refreshBackupState = useCallback(() => {
    // Reads this device's keystore. Resolves to 'none' rather than throwing on
    // platforms with no keystore, so the card degrades to "no identity here".
    getBackupState().then(setBackup).catch(() => setBackup('none'))
  }, [])

  useEffect(() => {
    refreshBackupState()
  }, [refreshBackupState])

  // The setup ceremony can flip this preference after the parent hook has
  // already read it, which would leave this switch showing the old value.
  // Re-read what is actually stored and push it up, so the hook stays the
  // single source of truth instead of drifting from disk.
  useEffect(() => {
    void getBiometricLockEnabled().then((stored) => {
      if (stored !== biometricEnabled) onToggleBiometric(stored)
    })
    // Intentionally on mount only: this reconciles once when the section
    // opens, and must not fight the user's own taps afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then((hasHardware) => {
      setHasBiometricHardware(hasHardware)
      if (hasHardware) {
        LocalAuthentication.isEnrolledAsync().then(setIsBiometricEnrolled)
      }
    })
  }, [])

  return (
    <View style={styles.stack}>
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Privacy settings</Text>
        <Text style={styles.listIntro}>
          Tap a badge to move an item between Public, Trusted only, and Private.
        </Text>
        {activePersona?.signals.map((signal) => (
          <View key={signal.label} style={rowStyle('default')}>
            <View style={rowStyles.text}>
              <Text style={rowStyles.title}>{signal.label}</Text>
              <Text style={rowStyles.detail}>{signal.value}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <VisibilityPill
                visibility={signal.visibility}
                onPress={() => {
                  hapticLight()
                  if (!activePersona) return
                  void onUpdateSignalVisibility(
                    activePersona.id,
                    signal.label,
                    nextVisibility(signal.visibility)
                  )
                }}
              />
              <Text style={{ color: tokens.muted, fontSize: 11 }}>
                {visibilityDestinationLabel(signal.visibility)} · {signal.action}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Consent ledger</Text>
        {session.consentLedger.length > 0 ? (
          session.consentLedger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
        ) : (
          <EmptyState icon="shield" title="Ledger empty" detail="Your consent history will appear here." />
        )}
      </View>

      {/*
        Devices: where this identity lives. This install touches its own
        entry on every bootstrap; restores add the restored-from holder.
        Borrowed from the Bluesky account Devices page: recency order,
        a badge on the current row, per-row removal disabled for it.
      */}
      <DevicesCard devices={devices} currentId={currentId} onRemoveDevice={removeDevice} />

      {/*
        Device & recovery: everything that protects or removes the identity on
        this device — recovery ceremony, biometric lock, sign-out — in one
        card. Recovery state is read from this device's own keystore, not from
        the session: the old card used to print `session.pdsSafety.lastBackup`,
        a string handed over by the broker describing a backup of a seed that
        was never created. Amber until the phrase is saved — the card is
        meant to insist.
      */}
      <View style={cardStyle(backup === 'done' ? 'filled' : 'warning')}>
        <Text style={styles.summaryEyebrow}>Device & recovery</Text>
        <Text style={styles.summaryTitle}>
          {backup === 'done'
            ? 'Recovery phrase saved'
            : backup === 'pending'
              ? 'Recovery phrase not saved yet'
              : 'No identity on this device'}
        </Text>
        <Text style={styles.summaryBody}>
          {backup === 'done'
            ? 'You can restore this identity on another device with your 24 words.'
            : backup === 'pending'
              ? 'If you lose this device now, this identity and every credential derived from it are gone.'
              : 'Create or restore an identity to hold credentials on this device.'}
        </Text>

        {backup === 'pending' && (
          <Pressable
            style={[buttonStyle('primary'), styles.recoveryAction]}
            onPress={() => setShowPhrase(true)}
            accessibilityRole="button"
            accessibilityLabel="Save my recovery phrase"
          >
            <Text style={buttonTextStyle('primary')}>Save recovery phrase</Text>
          </Pressable>
        )}

        {backup === 'none' && (
          <Pressable
            style={[buttonStyle('secondary'), styles.recoveryAction]}
            onPress={() => setShowRestore(true)}
            accessibilityRole="button"
            accessibilityLabel="Restore an identity from a recovery phrase"
          >
            <Text style={buttonTextStyle('secondary')}>Restore from phrase</Text>
          </Pressable>
        )}

        <View style={styles.deviceDivider} />

        <SettingsRow
          icon="shieldCheck"
          label="Biometric lock"
          detail={
            !hasBiometricHardware
              ? 'Not available on this device'
              : !isBiometricEnrolled
                ? 'No biometrics enrolled'
                : undefined
          }
          control={
            <Switch
              value={biometricEnabled}
              onValueChange={(value) => {
                hapticLight()
                onToggleBiometric(value)
              }}
              trackColor={{ false: tokens.stroke, true: tokens.success }}
              thumbColor={biometricEnabled ? tokens.text : tokens.muted}
              disabled={!hasBiometricHardware || !isBiometricEnrolled}
            />
          }
        />

        <View style={styles.deviceDivider} />

        {!showSignOutConfirm ? (
          <Pressable
            onPress={() => {
              hapticMedium()
              setShowSignOutConfirm(true)
            }}
            style={styles.destructiveRow}
          >
            <Icon name="circleX" size={18} color={tokens.danger} />
            <Text style={styles.destructiveText}>Sign out</Text>
          </Pressable>
        ) : (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>
              Are you sure? Your local identity will be removed from this device.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setShowSignOutConfirm(false)}
                style={[styles.confirmButton, { backgroundColor: tokens.surfaceRaised }]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  hapticMedium()
                  onSignOut()
                }}
                style={[styles.confirmButton, { backgroundColor: tokens.danger }]}
              >
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <RecoveryPhraseSheet
        visible={showPhrase}
        onClose={() => setShowPhrase(false)}
        onConfirmed={refreshBackupState}
      />
      <RestoreIdentitySheet
        visible={showRestore}
        onClose={() => setShowRestore(false)}
        onRestored={() => {
          refreshBackupState()
          // A completed restore means another holder exists: list it.
          void recordRestore()
        }}
      />

      {/*
        Diagnostics: recovery-relevant identifiers and build info. Each row
        copies on tap — a DID is not retypable, so it should not be static
        text.
      */}
      <View style={styles.diagnostics}>
        <Text style={styles.diagnosticsLabel}>Diagnostics</Text>
        <DiagnosticRow label="DID" value={session.did} />
        <DiagnosticRow
          label="Auth server"
          value={`${session.authorizationServer} · ${session.brokerMode}`}
        />
        <DiagnosticRow label="Build" value="iM8 Console v0.1 · poc-2026.05.19" />
      </View>
    </View>
  )
}

function nextVisibility(current: Visibility): Visibility {
  if (current === 'Public') return 'Trusted only'
  if (current === 'Trusted only') return 'Private'
  return 'Public'
}

function visibilityPillVariant(visibility: Visibility) {
  if (visibility === 'Public') return 'success' as const
  if (visibility === 'Private') return 'danger' as const
  return 'warning' as const
}

function VisibilityPill({ visibility, onPress }: { visibility: Visibility; onPress: () => void }) {
  const variant = visibilityPillVariant(visibility)
  const next = nextVisibility(visibility)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${visibility}. Move to ${next}.`}
      accessibilityHint={`Currently stored in ${visibilityDestinationLabel(visibility)}.`}
      hitSlop={8}
    >
      <View style={pillStyle(variant)}>
        <Text style={pillTextStyle(variant)}>{visibility}</Text>
      </View>
    </Pressable>
  )
}

function LedgerRow({ entry }: { entry: ConsentLedgerEntry }) {
  return (
    <View style={rowStyle('default')}>
      <View style={rowStyles.text}>
        <Text style={rowStyles.title}>{entry.subject}</Text>
        <Text style={rowStyles.detail}>{entry.detail}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={pillStyle(entry.action === 'Revoked' ? 'danger' : entry.action === 'Approved' ? 'success' : 'accent')}>
          <Text style={pillTextStyle(entry.action === 'Revoked' ? 'danger' : entry.action === 'Approved' ? 'success' : 'accent')}>
            {entry.action}
          </Text>
        </View>
        <Text style={{ color: tokens.muted, fontSize: 11 }}>{entry.timestamp}</Text>
      </View>
    </View>
  )
}

function DevicesCard({
  currentId,
  devices,
  onRemoveDevice,
}: {
  currentId: string | null
  devices: DeviceRecord[]
  onRemoveDevice: (id: string) => Promise<boolean>
}) {
  const [removingId, setRemovingId] = useState<string | null>(null)
  const sorted = useMemo(
    () =>
      [...devices].sort(
        (a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt),
      ),
    [devices],
  )
  return (
    <View style={styles.listCard}>
      <Text style={styles.listTitle}>Devices</Text>
      <Text style={styles.listIntro}>
        Where this identity lives. Remove anything you don&apos;t recognize.
      </Text>
      {sorted.length > 0 ? (
        sorted.map((device) => {
          const isCurrent = currentId !== null && device.id === currentId
          const removing = removingId === device.id
          return (
            <View key={device.id} style={rowStyle('default')}>
              <View style={[consoleStyles.surfaceIcon, { backgroundColor: tokens.surfaceRaised }]}>
                <Icon name="devices" size={20} color={tokens.accentSoft} />
              </View>
              <View style={rowStyles.text}>
                <Text style={rowStyles.title}>{device.label}</Text>
                <Text style={rowStyles.detail}>
                  Last seen {describeLastSeen(device.lastSeenAt)}
                </Text>
              </View>
              {isCurrent ? (
                <View style={pillStyle('accent')}>
                  <Text style={pillTextStyle('accent')}>This device</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    hapticMedium()
                    setRemovingId(device.id)
                    void onRemoveDevice(device.id).finally(() =>
                      setRemovingId((current) => (current === device.id ? null : current)),
                    )
                  }}
                  disabled={removing}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${device.label}`}
                  style={[
                    buttonStyle('secondary'),
                    styles.compactAction,
                    removing && consoleStyles.disabled,
                  ]}
                >
                  <Text style={buttonTextStyle('secondary')}>
                    {removing ? 'Removing…' : 'Remove'}
                  </Text>
                </Pressable>
              )}
            </View>
          )
        })
      ) : (
        <EmptyState
          icon="devices"
          title="No devices yet"
          detail="This install registers itself here on next launch."
        />
      )}
    </View>
  )
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <Pressable
      onPress={() => {
        hapticLight()
        void copyText(Clipboard.setStringAsync, value).then((ok) => {
          if (!ok) return
          setCopied(true)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), 1500)
        })
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Tap to copy.`}
    >
      <View style={rowStyle('default')}>
        <View style={rowStyles.text}>
          <Text style={rowStyles.detail}>{label}</Text>
          <Text style={rowStyles.title} numberOfLines={1}>
            {value}
          </Text>
        </View>
        {copied ? (
          <Text style={styles.copiedLabel}>Copied</Text>
        ) : (
          <Icon name="copy" size={16} color={tokens.muted} />
        )}
      </View>
    </Pressable>
  )
}

function SettingsRow({
  control,
  detail,
  icon,
  label,
}: {
  control: ReactNode
  detail?: string
  icon: 'shieldCheck'
  label: string
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowLeft}>
        <Icon name={icon} size={18} color={tokens.text} />
        <View>
          <Text style={styles.settingsRowLabel}>{label}</Text>
          {detail ? <Text style={styles.settingsRowDetail}>{detail}</Text> : null}
        </View>
      </View>
      {control}
    </View>
  )
}

const styles = StyleSheet.create({
  recoveryAction: { marginTop: 14 },
  compactAction: {
    flex: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  stack: {
    gap: 12,
    marginTop: 12,
  },
  listCard: {
    gap: 8,
  },
  listTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  listIntro: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  summaryEyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  summaryTitle: {
    color: tokens.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  summaryBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsRowLabel: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '600',
  },
  settingsRowDetail: {
    color: tokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.dangerTransparent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: tokens.dangerBorder,
  },
  destructiveText: {
    color: tokens.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmRow: {
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  confirmText: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelText: {
    color: tokens.text,
    fontWeight: '600',
  },
  signOutText: {
    color: tokens.onDanger,
    fontWeight: '700',
  },
  deviceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.glassBorder,
    marginVertical: 12,
  },
  diagnostics: {
    gap: 3,
    paddingTop: 10,
    paddingBottom: 6,
  },
  diagnosticsLabel: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  copiedLabel: {
    color: tokens.success,
    fontSize: 12,
    fontWeight: '700',
  },
})
