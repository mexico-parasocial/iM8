import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { buttonStyle, buttonTextStyle } from '../components/m8/Button'
import { cardStyle } from '../components/m8/Card'
import { pillStyle, pillTextStyle } from '../components/m8/Pill'
import { tokens } from '../theme'
import { type BootstrapStatus, type BrokerAttempt } from '../types'

const PROVIDERS = [
  { id: 'bsky', label: 'Bluesky', placeholder: 'handle.bsky.social' },
  { id: 'mastodon', label: 'Mastodon', placeholder: '@user@instance.social' },
  { id: 'custom', label: 'Custom PDS', placeholder: 'your-domain.com' },
]

export function AuthScreen({
  attempt,
  error,
  isLoading,
  onSubmit,
  status,
}: {
  attempt: BrokerAttempt | null
  error: string | null
  isLoading: boolean
  onSubmit: (input: string) => Promise<void>
  status: BootstrapStatus
}) {
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState('bsky')

  const activeProvider = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0]

  const buttonLabel =
    status === 'resolving'
      ? 'Finding your identity...'
      : status === 'hydrating'
        ? 'Loading your vault...'
        : `Continue with ${activeProvider.label}`

  const issue = classifyError(error)

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>m8</Text>
          <Text style={styles.title}>Your identity vault</Text>
          <Text style={styles.body}>
            Sign in to control what apps know about you. Proofs, not paperwork.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Identity provider</Text>
          <View style={styles.providerRow}>
            {PROVIDERS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setProvider(p.id)}
                style={[
                  pillStyle(provider === p.id ? 'accent' : 'muted'),
                  { flex: 1, alignItems: 'center' },
                ]}
              >
                <Text style={pillTextStyle(provider === p.id ? 'accent' : 'muted')}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{activeProvider.label} handle or DID</Text>
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
            onPress={() => void onSubmit(input)}
            disabled={isLoading || !input.trim()}
            style={[
              buttonStyle('primary'),
              { marginTop: 8 },
              (isLoading || !input.trim()) && { opacity: 0.5 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={tokens.onAccent} />
            ) : (
              <Text style={buttonTextStyle('primary')}>{buttonLabel}</Text>
            )}
          </Pressable>

          {error ? (
            <View style={[cardStyle('danger'), { marginTop: 12, padding: 12 }]}>
              <Text style={styles.errorEyebrow}>{issue.label}</Text>
              <Text style={styles.error}>{error}</Text>
              <Text style={styles.errorHint}>{issue.hint}</Text>
            </View>
          ) : null}

          {attempt ? (
            <View style={[cardStyle('accent'), { marginTop: 12, padding: 12 }]}>
              <Text style={styles.attemptTitle}>Found your identity</Text>
              <Text style={styles.attemptBody}>{attempt.handle}</Text>
              <Text style={styles.attemptMeta}>{attempt.authorizationServer}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            m8 uses ATProto to verify your identity. We never store your password.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

function classifyError(error: string | null) {
  if (!error) {
    return { label: 'Ready', hint: 'Enter your handle to continue.' }
  }
  const text = error.toLowerCase()
  if (text.includes('network') || text.includes('fetch') || text.includes('broker')) {
    return { label: 'Connection issue', hint: 'Check your internet and try again.' }
  }
  if (text.includes('not found') || text.includes('resolve')) {
    return { label: 'Identity not found', hint: 'Double-check your handle or try a different provider.' }
  }
  return { label: 'Sign-in failed', hint: 'Something went wrong. Try again or use a different handle.' }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  screen: {
    flex: 1,
    padding: 24,
    gap: 24,
    justifyContent: 'center',
  },
  header: {
    gap: 8,
    alignItems: 'center',
  },
  brand: {
    color: tokens.accent,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  title: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    color: tokens.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    ...cardStyle('filled'),
    gap: 12,
  },
  label: {
    color: tokens.text,
    fontSize: 13,
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surfaceRaised,
    color: tokens.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorEyebrow: {
    color: tokens.danger,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  error: {
    color: tokens.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  errorHint: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  attemptTitle: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  attemptBody: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  attemptMeta: {
    color: tokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
})
