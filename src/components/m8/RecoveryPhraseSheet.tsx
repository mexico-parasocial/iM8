import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { ResponsiveSheet } from './ResponsiveSheet'
import {
  authenticateWithDeviceCredential,
  biometricLockAvailability,
  setBiometricLockEnabled,
} from './BiometricGate'
import { buttonStyle, buttonTextStyle } from './Button'
import { Icon } from './Icon'
import { tokens } from '../../theme'
import {
  confirmRecoveryPhraseSaved,
  revealRecoveryPhrase,
} from '../../services/identityEnrollment'

type Stage = 'warning' | 'revealed' | 'protect' | 'error'

/**
 * The backup ceremony.
 *
 * These twenty-four words are the only way back to this identity: the seed
 * lives in the device keystore and nowhere else, so a lost phone with no phrase
 * written down is a lost identity — and with it every credential derived from
 * it. That is why the flow gates on presence before revealing, and why the
 * phrase is held in state only while this sheet is open.
 *
 * Deliberately absent: copy-to-clipboard and screenshot-friendly layout. A
 * clipboard is readable by other apps and a screenshot lands in a photo library
 * that usually syncs to a cloud — both quietly relocate the seed off the device
 * whose keystore was the entire point.
 */
export function RecoveryPhraseSheet({
  visible,
  onClose,
  onConfirmed,
}: {
  visible: boolean
  onClose: () => void
  onConfirmed?: () => void
}) {
  const [stage, setStage] = useState<Stage>('warning')
  const [words, setWords] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lockOn, setLockOn] = useState(true)

  // Drop the phrase the moment the sheet closes; never let it outlive the
  // ceremony in component state.
  useEffect(() => {
    if (!visible) {
      setWords([])
      setStage('warning')
      setError(null)
      setLockOn(true)
    }
  }, [visible])

  async function handleReveal() {
    setBusy(true)
    setError(null)
    try {
      const auth = await authenticateWithDeviceCredential(
        'Confirma tu identidad para ver tu frase de recuperación',
      )
      if (!auth.ok) {
        // "Declined" and "nothing to authenticate with" need different copy:
        // telling someone to retry when their phone has no passcode at all is
        // a loop with no way out.
        setError(
          auth.reason === 'no-credential'
            ? 'Este aparato no tiene código ni huella configurados. Actívalos en Ajustes para poder ver tu frase — es lo que impide que alguien más la vea si toma tu teléfono.'
            : 'No pudimos verificar tu identidad. Inténtalo de nuevo.',
        )
        return
      }
      const phrase = await revealRecoveryPhrase()
      setWords(phrase.split(/\s+/).filter(Boolean))
      setStage('revealed')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo leer la frase de recuperación.',
      )
      setStage('error')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    setBusy(true)
    try {
      await confirmRecoveryPhraseSaved()
      // Drop the phrase before rendering anything else.
      setWords([])
      onConfirmed?.()

      // Offer the lock here rather than only in Settings: this is the moment
      // the identity becomes real, and a phrase just written on paper is worth
      // protecting against whoever picks up the unlocked phone. Skipped
      // entirely when the device has no biometrics to offer.
      const { available } = await biometricLockAvailability()
      if (available) {
        setStage('protect')
      } else {
        onClose()
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo guardar el estado.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleFinishProtect() {
    setBusy(true)
    try {
      await setBiometricLockEnabled(lockOn)
      onClose()
    } catch {
      // A failed preference write must not trap the user in the ceremony —
      // the phrase is already saved, which was the point of this flow.
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} size="md" scroll>
      <View style={styles.header}>
        <Icon name="key" size={20} color={tokens.warning} />
        <Text style={styles.title}>Frase de recuperación</Text>
      </View>

      {stage === 'warning' && (
        <View>
          <Text style={styles.body}>
            Son veinticuatro palabras y son la única forma de recuperar tu
            identidad. Si pierdes este aparato sin haberlas anotado, se pierden
            también todas tus constancias.
          </Text>
          <View style={styles.rules}>
            <Rule text="Anótalas en papel, en orden." />
            <Rule text="Guárdalas donde no las guarde nadie más." />
            <Rule text="Nadie de Ápice ni del partido te las va a pedir nunca." />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[buttonStyle('primary'), busy && styles.disabled]}
            disabled={busy}
            onPress={handleReveal}
            accessibilityRole="button"
            accessibilityLabel="Mostrar la frase de recuperación"
          >
            <Text style={buttonTextStyle('primary')}>
              {busy ? 'Verificando…' : 'Mostrar las palabras'}
            </Text>
          </Pressable>
        </View>
      )}

      {stage === 'revealed' && (
        <View>
          <Text style={styles.body}>
            Anótalas ahora, en este orden. No vuelven a mostrarse solas.
          </Text>
          <ScrollView style={styles.gridScroll}>
            <View style={styles.grid}>
              {words.map((word, index) => (
                <View key={`${index}-${word}`} style={styles.wordCell}>
                  <Text style={styles.wordIndex}>{index + 1}</Text>
                  <Text style={styles.word}>{word}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[buttonStyle('primary'), busy && styles.disabled]}
            disabled={busy}
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirmar que anoté la frase"
          >
            <Text style={buttonTextStyle('primary')}>Ya las anoté</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Todavía no</Text>
          </Pressable>
        </View>
      )}

      {stage === 'protect' && (
        <View>
          <Text style={styles.body}>
            Tu frase está guardada. ¿Quieres pedir huella o Face ID cada vez que
            se abra la app?
          </Text>
          <View style={styles.lockRow}>
            <View style={styles.lockCopy}>
              <Text style={styles.lockTitle}>Bloqueo biométrico</Text>
              <Text style={styles.lockDetail}>
                Puedes cambiarlo cuando quieras desde Ajustes.
              </Text>
            </View>
            <Switch
              value={lockOn}
              onValueChange={setLockOn}
              trackColor={{ false: tokens.stroke, true: tokens.success }}
              thumbColor={lockOn ? tokens.text : tokens.muted}
              accessibilityLabel="Activar bloqueo biométrico"
            />
          </View>
          <Pressable
            style={[buttonStyle('primary'), busy && styles.disabled]}
            disabled={busy}
            onPress={handleFinishProtect}
            accessibilityRole="button"
            accessibilityLabel="Terminar configuración"
          >
            <Text style={buttonTextStyle('primary')}>Listo</Text>
          </Pressable>
        </View>
      )}

      {stage === 'error' && (
        <View>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={buttonStyle('secondary')} onPress={onClose}>
            <Text style={buttonTextStyle('secondary')}>Cerrar</Text>
          </Pressable>
        </View>
      )}
    </ResponsiveSheet>
  )
}

function Rule({ text }: { text: string }) {
  return (
    <View style={styles.rule}>
      <Icon name="check" size={14} color={tokens.accent} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { color: tokens.text, fontSize: 18, fontWeight: '700' },
  body: { color: tokens.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  rules: { gap: 8, marginBottom: 18 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleText: { color: tokens.text, fontSize: 13, flex: 1, lineHeight: 19 },
  gridScroll: { maxHeight: 300, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordCell: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: '30%',
  },
  wordIndex: { color: tokens.muted, fontSize: 11, minWidth: 16 },
  word: { color: tokens.text, fontSize: 14, fontWeight: '600' },
  error: {
    color: tokens.danger,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 19,
  },
  disabled: { opacity: 0.5 },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  lockCopy: { flex: 1 },
  lockTitle: { color: tokens.text, fontSize: 14, fontWeight: '600' },
  lockDetail: { color: tokens.muted, fontSize: 12, marginTop: 2 },
  secondary: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  secondaryText: { color: tokens.muted, fontSize: 14 },
})
