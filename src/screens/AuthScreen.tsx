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
]

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
        : `Restore with ${activeProvider.label}`

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
          <Text style={styles.brand}>iM8</Text>
          <Text style={styles.title}>Move privately.</Text>
        </View>

        <View style={styles.main}>
          <View style={styles.identityCard}>
            <Text style={styles.handleValue}>{generatedHandle}</Text>
            <Text style={styles.handleLabel}>Your first anonymous card</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleCreateLocal}
              disabled={isLoading}
              style={[styles.startButton, isLoading && styles.disabled]}
            >
              {isLoading ? (
                <ActivityIndicator color={tokens.onAccent} />
              ) : (
                <Text style={styles.startButtonText}>Start</Text>
              )}
            </Pressable>
            <Pressable
              onPress={regenerate}
              disabled={isLoading}
              style={[styles.shuffleButton, isLoading && styles.disabled]}
            >
              <Text style={styles.shuffleButtonText}>Shuffle name</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setMode(mode === 'link' ? 'create' : 'link')}
            style={styles.linkToggle}
          >
            <Text style={styles.linkToggleText}>
              {mode === 'link' ? 'Hide restore' : 'Restore existing account'}
            </Text>
          </Pressable>

          {mode === 'link' ? (
            <View style={styles.stack}>
              <View style={cardStyle('filled')}>
                <Text style={styles.sectionTitle}>Restore existing session</Text>
                <Text style={styles.sectionBody}>
                  Use a Bluesky handle or DID to reopen an account you already started.
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
          ) : null}

          {__DEV__ ? (
            <Pressable onPress={() => void onCreateLocal('demo')} style={styles.devLink}>
              <Icon name="zap" size={12} color={tokens.muted} />
              <Text style={styles.devLinkText}>Dev: open demo</Text>
            </Pressable>
          ) : null}
        </View>

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

function classifyError(error: string | null) {
  if (!error) {
    return { label: 'Ready', hint: 'Start privately or restore an existing session.', isOffline: false }
  }
  const text = error.toLowerCase()
  if (text.includes('network') || text.includes('fetch') || text.includes('broker')) {
    return { label: 'Connection issue', hint: 'Check your connection, or start with local iM8.', isOffline: true }
  }
  if (text.includes('not found') || text.includes('resolve')) {
    return { label: 'Identity not found', hint: 'Double-check the handle or switch providers.', isOffline: false }
  }
  return { label: 'Setup failed', hint: 'Try again or start with local iM8.', isOffline: false }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  screen: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 40,
  },
  brandBlock: {
    gap: 14,
  },
  brand: {
    color: tokens.accent,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  kicker: {
    color: tokens.success,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: tokens.text,
    fontSize: 44,
    lineHeight: 49,
    fontWeight: '800',
    letterSpacing: 0,
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
  main: {
    gap: 18,
  },
  laneGrid: {
    gap: 8,
  },
  laneCard: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  laneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  laneLabel: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  laneTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  lanePreview: {
    color: tokens.accentSoft,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  laneBody: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  identityCard: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
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
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  handleValue: {
    color: tokens.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: 0,
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
    gap: 10,
  },
  startButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accent,
  },
  startButtonText: {
    color: tokens.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  shuffleButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surfaceTransparent,
  },
  shuffleButtonText: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '800',
  },
  compactButton: {
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  linkToggle: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  linkToggleText: {
    color: tokens.muted,
    fontSize: 13,
    fontWeight: '800',
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
