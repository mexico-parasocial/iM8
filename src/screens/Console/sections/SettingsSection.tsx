import { useEffect, useState, type ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { cardStyle } from '../../../components/m8/Card'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { EmptyState, SimpleRow } from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import type { IdentitySession, Persona, ConsentLedgerEntry } from '../../../types'
import { tokens } from '../../../theme'
import { hapticLight, hapticMedium } from '../../../utils/haptics'

export function SettingsSection({
  session,
  activePersona,
  biometricEnabled,
  onSignOut,
  onToggleBiometric,
}: {
  session: IdentitySession
  activePersona: Persona | undefined
  biometricEnabled: boolean
  onSignOut: () => void
  onToggleBiometric: (value: boolean) => void
}) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false)
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false)

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
        {activePersona?.signals.map((signal) => (
          <View key={signal.label} style={rowStyle('default')}>
            <View style={rowStyles.text}>
              <Text style={rowStyles.title}>{signal.label}</Text>
              <Text style={rowStyles.detail}>{signal.value}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={pillStyle(signal.visibility === 'Public' ? 'success' : signal.visibility === 'Private' ? 'danger' : 'warning')}>
                <Text style={pillTextStyle(signal.visibility === 'Public' ? 'success' : signal.visibility === 'Private' ? 'danger' : 'warning')}>
                  {signal.visibility}
                </Text>
              </View>
              <Text style={{ color: tokens.muted, fontSize: 11 }}>{signal.action}</Text>
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

      <View style={cardStyle('filled')}>
        <Text style={styles.summaryEyebrow}>PDS safety</Text>
        <Text style={styles.summaryTitle}>{session.pdsSafety.state}</Text>
        <Text style={styles.summaryBody}>
          {session.pdsSafety.detail} Source: {session.pdsSafety.source}. Last backup: {session.pdsSafety.lastBackup}.
        </Text>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Session record</Text>
        <Text style={styles.listIntro}>Technical details for recovery and app compatibility.</Text>
        <SimpleRow icon="person" title="Display name" detail={session.displayName} meta="Local" />
        <SimpleRow icon="shield" title="DID" detail={session.did} meta="Portable" />
        <SimpleRow icon="globe" title="Auth server" detail={session.authorizationServer} meta={session.brokerMode} />
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Security</Text>
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
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Account</Text>
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

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>About</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>iM8 Console v0.1</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Build</Text>
          <Text style={styles.aboutValue}>poc-2026.05.19</Text>
        </View>
      </View>
    </View>
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
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aboutLabel: {
    color: tokens.muted,
    fontSize: 14,
  },
  aboutValue: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '500',
  },
})
