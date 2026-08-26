import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { EmptyState } from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { RecoveryPhraseSheet } from '../../../components/m8/RecoveryPhraseSheet'
import { RestoreIdentitySheet } from '../../../components/m8/RestoreIdentitySheet'
import { getBackupState, type BackupState } from '../../../services/seedVault'
import { getBiometricLockEnabled } from '../../../components/m8/BiometricGate'
import { visibilityDestinationLabel } from '../../../contracts/profileFacets'
import type { IdentitySession, Persona, ConsentLedgerEntry, Visibility } from '../../../types'
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
          Tap a badge to change where each item lives. Public items publish to your public
          profile, Trusted only items go to your PARA facet space, and Private items never
          leave this device.
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
        onRestored={refreshBackupState}
      />

      {/*
        Diagnostics: recovery-relevant identifiers and build info, quiet and
        chrome-less. Nothing here is actionable; it exists for support moments.
      */}
      <View style={styles.diagnostics}>
        <Text style={styles.diagnosticsLabel}>Diagnostics</Text>
        <Text style={styles.diagnosticsLine}>DID  {session.did}</Text>
        <Text style={styles.diagnosticsLine}>
          Auth server  {session.authorizationServer} · {session.brokerMode}
        </Text>
        <Text style={styles.diagnosticsLine}>iM8 Console v0.1 · poc-2026.05.19</Text>
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
  diagnosticsLine: {
    color: tokens.muted,
    fontSize: 11,
    lineHeight: 15,
  },
})
