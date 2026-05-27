import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { buttonStyle, buttonTextStyle } from '../components/m8/Button'
import { cardStyle } from '../components/m8/Card'
import { Icon } from '../components/m8/Icon'
import { generateAnonymousHandle } from '../services/identityNames'
import { tokens } from '../theme'
import { type BootstrapStatus, type BrokerAttempt } from '../types'

const EXISTING_PROVIDERS = [
  { id: 'bsky', label: 'Bluesky', placeholder: 'handle.bsky.social' },
  { id: 'mastodon', label: 'Mastodon', placeholder: '@user@instance.social' },
  { id: 'custom', label: 'Custom PDS', placeholder: 'your-domain.com' },
]

const SETUP_STEPS = [
  { label: 'Create', state: 'active' },
  { label: 'Verify', state: 'next' },
  { label: 'Name', state: 'next' },
  { label: 'PARA', state: 'next' },
] as const

export function AuthScreen({
  attempt,
  error,
  isLoading,
  onCreateLocal,
  onSubmit,
  status,
}: {
  attempt: BrokerAttempt | null
  error: string | null
  isLoading: boolean
  onCreateLocal: (handle: string) => Promise<void>
  onSubmit: (input: string) => Promise<void>
  status: BootstrapStatus
}) {
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState('bsky')
  const [generatedHandle, setGeneratedHandle] = useState(() => generateAnonymousHandle())

  const activeProvider = EXISTING_PROVIDERS.find((p) => p.id === provider) ?? EXISTING_PROVIDERS[0]
  const issue = classifyError(error)

  const regenerate = useCallback(() => {
    setGeneratedHandle(generateAnonymousHandle())
  }, [])

  const linkButtonLabel =
    status === 'resolving'
      ? 'Finding identity...'
      : status === 'hydrating'
        ? 'Opening vault...'
        : `Continue with ${activeProvider.label}`

  function handleCreateLocal() {
    void onCreateLocal(generatedHandle)
  }

  function handleLinkExisting() {
    const handle = input.trim()
    if (!handle) return
    void onSubmit(handle)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screen}
      >
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>m8</Text>
          <Text style={styles.title}>Make an identity you can actually use.</Text>
          <Text style={styles.subtitle}>
            Start private, verify only when you are ready, then use PARA with proofs instead of
            raw personal data.
          </Text>
        </View>

        <View style={styles.stepRail}>
          {SETUP_STEPS.map((step, index) => (
            <View key={step.label} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  step.state === 'active' && styles.stepDotActive,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    step.state === 'active' && styles.stepNumberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  step.state === 'active' && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => setMode('create')}
            style={[styles.modeButton, mode === 'create' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === 'create' && styles.modeTextActive]}>
              Create identity
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('link')}
            style={[styles.modeButton, mode === 'link' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === 'link' && styles.modeTextActive]}>
              Link existing
            </Text>
          </Pressable>
        </View>

        {mode === 'create' ? (
          <View style={styles.stack}>
            <View style={styles.identityCard}>
              <View style={styles.cardTopline}>
                <Icon name="lock" size={18} color={tokens.success} />
                <Text style={styles.cardToplineText}>Private identity card</Text>
              </View>
              <Text style={styles.handleLabel}>Generated handle</Text>
              <View style={styles.handleRow}>
                <Text style={styles.handleValue}>{generatedHandle}</Text>
                <Text style={styles.handleSuffix}>.m8.local</Text>
              </View>
              <Text style={styles.cardBody}>
                This is enough to enter m8 now. Verification unlocks PARA proofs and one optional
                public name change later.
              </Text>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                onPress={regenerate}
                disabled={isLoading}
                style={[buttonStyle('secondary'), styles.compactButton, isLoading && styles.disabled]}
              >
                <Text style={buttonTextStyle('secondary')}>New name</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateLocal}
                disabled={isLoading}
                style={[buttonStyle('primary'), styles.compactButton, isLoading && styles.disabled]}
              >
                {isLoading ? (
                  <ActivityIndicator color={tokens.onAccent} />
                ) : (
                  <Text style={buttonTextStyle('primary')}>Create and continue</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.promiseGrid}>
              <PromiseTile icon="shieldCheck" title="Proof-only" body="Apps can ask for outcomes, not documents." />
              <PromiseTile icon="pencil" title="Rename later" body="Verification unlocks one public name choice." />
              <PromiseTile icon="globe" title="PARA-ready" body="Your first verified actions live in PARA." />
            </View>

            {__DEV__ ? (
              <Pressable onPress={() => void onCreateLocal('demo')} style={styles.devLink}>
                <Icon name="zap" size={12} color={tokens.muted} />
                <Text style={styles.devLinkText}>Dev: open demo identity</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.stack}>
            <View style={cardStyle('filled')}>
              <Text style={styles.sectionTitle}>Bring an existing account</Text>
              <Text style={styles.sectionBody}>
                m8 will layer proof requests, consent receipts, and PARA compatibility on top of
                your current identity.
              </Text>

              <View style={styles.providerRow}>
                {EXISTING_PROVIDERS.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setProvider(item.id)}
                    style={[
                      styles.providerChip,
                      provider === item.id && styles.providerChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.providerText,
                        provider === item.id && styles.providerTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>{activeProvider.label} handle or DID</Text>
              <TextInput
                value={input}
                onChangeText={setInput}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                placeholder={activeProvider.placeholder}
                placeholderTextColor={tokens.muted}
              />

              <Pressable
                onPress={handleLinkExisting}
                disabled={isLoading || !input.trim()}
                style={[
                  buttonStyle('primary'),
                  { marginTop: 12 },
                  (isLoading || !input.trim()) && styles.disabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={tokens.onAccent} />
                ) : (
                  <Text style={buttonTextStyle('primary')}>{linkButtonLabel}</Text>
                )}
              </Pressable>
            </View>

            {attempt ? (
              <View style={cardStyle('accent')}>
                <Text style={styles.receiptLabel}>Identity found</Text>
                <Text style={styles.receiptTitle}>{attempt.handle}</Text>
                <Text style={styles.receiptBody}>{attempt.authorizationServer}</Text>
              </View>
            ) : null}
          </View>
        )}

        {error ? (
          <View style={cardStyle('danger')}>
            <Text style={styles.errorTitle}>{issue.label}</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorHint}>{issue.hint}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function PromiseTile({
  body,
  icon,
  title,
}: {
  body: string
  icon: 'shieldCheck' | 'pencil' | 'globe'
  title: string
}) {
  return (
    <View style={styles.promiseTile}>
      <Icon name={icon} size={18} color={tokens.accentSoft} />
      <Text style={styles.promiseTitle}>{title}</Text>
      <Text style={styles.promiseBody}>{body}</Text>
    </View>
  )
}

function classifyError(error: string | null) {
  if (!error) {
    return { label: 'Ready', hint: 'Create an m8 identity or link a handle.', isOffline: false }
  }
  const text = error.toLowerCase()
  if (text.includes('network') || text.includes('fetch') || text.includes('broker')) {
    return { label: 'Connection issue', hint: 'Check your connection, or create a local m8 identity.', isOffline: true }
  }
  if (text.includes('not found') || text.includes('resolve')) {
    return { label: 'Identity not found', hint: 'Double-check the handle or switch providers.', isOffline: false }
  }
  return { label: 'Setup failed', hint: 'Try again or start with a private m8 identity.', isOffline: false }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  screen: {
    flexGrow: 1,
    padding: 20,
    gap: 18,
  },
  brandBlock: {
    gap: 8,
    paddingTop: 8,
  },
  brand: {
    color: tokens.accent,
    fontSize: 42,
    fontWeight: '800',
  },
  title: {
    color: tokens.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
  },
  subtitle: {
    color: tokens.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  stepRail: {
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
    padding: 10,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  stepDotActive: {
    backgroundColor: tokens.accent,
    borderColor: tokens.accent,
  },
  stepNumber: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  stepNumberActive: {
    color: tokens.onAccent,
  },
  stepLabel: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  stepLabelActive: {
    color: tokens.text,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: tokens.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: tokens.accent,
  },
  modeText: {
    color: tokens.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: tokens.onAccent,
  },
  stack: {
    gap: 12,
  },
  identityCard: {
    ...cardStyle('accent'),
    borderRadius: 18,
    padding: 18,
  },
  cardTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardToplineText: {
    color: tokens.success,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  handleLabel: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  handleValue: {
    color: tokens.text,
    fontSize: 30,
    fontWeight: '800',
  },
  handleSuffix: {
    color: tokens.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compactButton: {
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  promiseGrid: {
    gap: 8,
  },
  promiseTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  promiseTitle: {
    color: tokens.text,
    width: 94,
    fontSize: 13,
    fontWeight: '800',
  },
  promiseBody: {
    color: tokens.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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
  inputLabel: {
    color: tokens.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
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
  },
  receiptLabel: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  receiptTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  receiptBody: {
    color: tokens.muted,
    fontSize: 12,
  },
  errorTitle: {
    color: tokens.danger,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorBody: {
    color: tokens.text,
    fontSize: 14,
    lineHeight: 20,
  },
  errorHint: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  devLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  devLinkText: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '600',
  },
})
