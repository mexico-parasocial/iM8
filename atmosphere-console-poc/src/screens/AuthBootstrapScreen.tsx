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
import { palette } from '../theme'
import { type BootstrapStatus, type BrokerAttempt } from '../types'

const brokerSteps = [
  'Normalize the identifier',
  'Resolve the authorization server',
  'Hydrate a proof-broker session',
  'Open claim review, proof grants, and safety controls',
]

export function AuthBootstrapScreen({
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
  const [input, setInput] = useState('mlv')

  const buttonLabel =
    status === 'resolving'
      ? 'Resolving identity...'
      : status === 'hydrating'
        ? 'Hydrating session...'
        : 'Continue with ATProto'
  const brokerIssue = classifyBrokerIssue(error)

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>m8 atmosphere</Text>
          <Text style={styles.title}>Proof-broker sign-in for scoped identity sharing.</Text>
          <Text style={styles.body}>
            The mobile app stays thin. A broker will own OAuth state, callback handling,
            claim review, proof-only grants, and safety enrichment. PARA can verify civic
            claims without exposing the raw source records.
          </Text>

          <Text style={styles.label}>Handle, DID, or service URL</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            placeholder="mlv"
            placeholderTextColor={palette.muted}
          />

          <Pressable
            onPress={() => void onSubmit(input)}
            style={[styles.button, isLoading && styles.buttonDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#07111f" />
            ) : (
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            )}
          </Pressable>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorEyebrow}>{brokerIssue.label}</Text>
              <Text style={styles.error}>{error}</Text>
              <Text style={styles.errorHint}>{brokerIssue.hint}</Text>
            </View>
          ) : null}

          {attempt ? (
            <View style={styles.attemptCard}>
              <Text style={styles.attemptTitle}>Broker prepared</Text>
              <Text style={styles.attemptBody}>{attempt.phaseLabel}</Text>
              <Text style={styles.attemptMeta}>{attempt.handle}</Text>
              <Text style={styles.attemptMeta}>{attempt.authorizationServer}</Text>
              <Text style={styles.attemptMeta}>
                Proof-only sharing is the default for sensitive civic claims.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Broker workflow</Text>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={palette.accent} />
              <Text style={styles.loadingText}>
                {status === 'resolving'
                  ? 'Broker is resolving the identity and checking availability.'
                  : 'Broker is hydrating the session, PARA status, and proof ledger.'}
              </Text>
            </View>
          ) : null}
          {brokerSteps.map((step, index) => (
            <View key={step} style={styles.row}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>{index + 1}</Text>
              </View>
              <Text style={styles.rowText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screen: {
    flex: 1,
    padding: 18,
    gap: 14,
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  eyebrow: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    marginTop: 10,
  },
  body: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 18,
  },
  label: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.stroke,
    backgroundColor: palette.surfaceRaised,
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#07111f',
    fontSize: 15,
    fontWeight: '800',
  },
  error: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  errorCard: {
    marginTop: 12,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: 'rgba(255, 141, 141, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 141, 0.2)',
  },
  errorEyebrow: {
    color: palette.danger,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  attemptCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(79, 167, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 167, 255, 0.18)',
  },
  attemptTitle: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  attemptBody: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  attemptMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 6,
  },
  listCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.stroke,
    gap: 10,
  },
  listTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(79, 167, 255, 0.08)',
  },
  loadingText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: palette.surfaceRaised,
  },
  stepPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 190, 99, 0.14)',
  },
  stepPillText: {
    color: palette.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  rowText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
  },
})

function classifyBrokerIssue(error: string | null) {
  if (!error) {
    return {
      label: 'Broker ready',
      hint: 'You can continue once the backend session is available.',
    }
  }

  const text = error.toLowerCase()

  if (text.includes('no active broker session') || text.includes('broker') || text.includes('network') || text.includes('fetch')) {
    return {
      label: 'Broker unavailable',
      hint: 'The local proof broker could not be reached. Retry once the service is back online.',
    }
  }

  return {
    label: 'Sign-in issue',
    hint: 'The broker rejected the request before a session could be hydrated.',
  }
}
