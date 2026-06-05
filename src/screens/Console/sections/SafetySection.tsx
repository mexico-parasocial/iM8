import { useEffect, useState, type ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, Switch } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { MiniStat, CoreRow, EmptyState } from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import type { IdentitySession, Persona, SafetyAction, ConsentLedgerEntry, SocialLink, SocialProvider } from '../../../types'
import { tokens } from '../../../theme'
import { hapticLight, hapticMedium } from '../../../utils/haptics'

export function SettingsSection({
  session,
  activePersona,
  biometricEnabled,
  darkMode,
  onLinkPublicSocial,
  onSignOut,
  onToggleBiometric,
  onToggleDarkMode,
  onUnlinkPublicSocial,
}: {
  session: IdentitySession
  activePersona: Persona | undefined
  biometricEnabled: boolean
  darkMode: boolean
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
  onSignOut: () => void
  onToggleBiometric: (value: boolean) => void
  onToggleDarkMode: (value: boolean) => void
  onUnlinkPublicSocial: (id: string) => Promise<void>
}) {
  const activePublicLinks = (session.publicLinks ?? []).filter((link) => link.status === 'linked')
  const publicPersona = session.publicPersonaId
    ? session.personas.find((persona) => persona.id === session.publicPersonaId)
    : session.personas.find((persona) => persona.kind === 'public')
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
        <Text style={styles.listTitle}>Public Links & Exposure</Text>
        <Text style={styles.listIntro}>
          Social accounts create or attach to the public card only. Anonymous cards and the private civic root stay separate, and these links never change durable PARA policy.
        </Text>
        {activePublicLinks.length > 0 ? (
          activePublicLinks.map((link) => (
            <PublicLinkRow
              key={link.id}
              link={link}
              publicPersona={publicPersona}
              onUnlinkPublicSocial={onUnlinkPublicSocial}
            />
          ))
        ) : (
          <EmptyState
            icon="globe"
            title={publicPersona ? 'No public socials linked' : 'No public identity linked'}
            detail={publicPersona ? 'The public card exists without Instagram, X, or Bluesky attached.' : 'Link Instagram, X, or Bluesky to create a public card.'}
          />
        )}
        <PublicLinkComposer onLinkPublicSocial={onLinkPublicSocial} />
      </View>

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
        <Text style={styles.listTitle}>Safety actions</Text>
        {session.safetyActions.map((action) => (
          <SafetyActionRow key={action.title} action={action} />
        ))}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Appearance</Text>
        <SettingsRow
          icon="moon"
          label="Dark mode"
          control={
            <Switch
              value={darkMode}
              onValueChange={(value) => {
                hapticLight()
                onToggleDarkMode(value)
              }}
              trackColor={{ false: tokens.stroke, true: tokens.accent }}
              thumbColor={darkMode ? tokens.text : tokens.muted}
            />
          }
        />
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

export const SafetySection = SettingsSection

const SOCIAL_PROVIDERS: { id: SocialProvider; label: string; placeholder: string }[] = [
  { id: 'instagram', label: 'Instagram', placeholder: 'instagram_handle' },
  { id: 'x', label: 'X', placeholder: 'x_handle' },
  { id: 'bsky', label: 'Bluesky', placeholder: 'handle.bsky.social' },
]

function providerLabel(provider: SocialProvider) {
  if (provider === 'bsky') return 'Bluesky'
  if (provider === 'x') return 'X'
  return 'Instagram'
}

function PublicLinkRow({
  link,
  publicPersona,
  onUnlinkPublicSocial,
}: {
  link: SocialLink
  publicPersona: Persona | undefined
  onUnlinkPublicSocial: (id: string) => Promise<void>
}) {
  return (
    <View style={rowStyle('default')}>
      <View style={rowStyles.text}>
        <Text style={rowStyles.title}>{providerLabel(link.provider)} linked locally</Text>
        <Text style={rowStyles.detail}>
          @{link.handle} created {publicPersona?.name ?? 'public card'}. Exposes selected public proofs only.
        </Text>
        <Text style={styles.separationNote}>Not linked to anonymous cards.</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={pillStyle('success')}>
          <Text style={pillTextStyle('success')}>Linked</Text>
        </View>
        <Pressable onPress={() => void onUnlinkPublicSocial(link.id)} style={styles.unlinkButton}>
          <Text style={styles.unlinkText}>Unlink</Text>
        </Pressable>
      </View>
    </View>
  )
}

function PublicLinkComposer({
  onLinkPublicSocial,
}: {
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
}) {
  const [provider, setProvider] = useState<SocialProvider>('instagram')
  const [handle, setHandle] = useState('')
  const activeProvider = SOCIAL_PROVIDERS.find((item) => item.id === provider) ?? SOCIAL_PROVIDERS[0]

  return (
    <View style={styles.composer}>
      <View style={styles.providerRow}>
        {SOCIAL_PROVIDERS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setProvider(item.id)}
            style={[styles.providerChip, provider === item.id && styles.providerChipActive]}
          >
            <Text style={[styles.providerText, provider === item.id && styles.providerTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inputRow}>
        <Icon name="globe" size={18} color={tokens.accentSoft} />
        <TextInput
          value={handle}
          onChangeText={setHandle}
          style={styles.input}
          placeholder={activeProvider.placeholder}
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <Pressable
        onPress={() => {
          void onLinkPublicSocial(provider, handle)
          setHandle('')
        }}
        disabled={!handle.trim()}
        style={[buttonStyle('primary'), !handle.trim() && styles.disabled]}
      >
        <Text style={buttonTextStyle('primary')}>Link social to public card</Text>
      </Pressable>
    </View>
  )
}

function SafetyActionRow({ action }: { action: SafetyAction }) {
  return (
    <View style={rowStyle('default')}>
      <View style={rowStyles.text}>
        <Text style={rowStyles.title}>{action.title}</Text>
        <Text style={rowStyles.detail}>{action.detail}</Text>
      </View>
      <View style={pillStyle(action.urgency === 'Now' ? 'danger' : action.urgency === 'Soon' ? 'warning' : 'muted')}>
        <Text style={pillTextStyle(action.urgency === 'Now' ? 'danger' : action.urgency === 'Soon' ? 'warning' : 'muted')}>
          {action.urgency}
        </Text>
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
  icon: 'moon' | 'shieldCheck'
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
  separationNote: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  composer: {
    gap: 8,
    marginTop: 4,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  providerChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 9,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  providerChipActive: {
    backgroundColor: tokens.accentTransparent,
    borderColor: tokens.accentBorder,
  },
  providerText: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  providerTextActive: {
    color: tokens.accentSoft,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surfaceRaised,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: tokens.text,
    paddingVertical: 13,
    fontSize: 16,
  },
  unlinkButton: {
    paddingVertical: 2,
  },
  unlinkText: {
    color: tokens.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
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
