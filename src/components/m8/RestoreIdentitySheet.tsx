import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ResponsiveSheet } from './ResponsiveSheet'
import { buttonStyle, buttonTextStyle } from './Button'
import { Icon } from './Icon'
import { tokens } from '../../theme'
import { enrollFromMnemonic } from '../../services/identityEnrollment'

/**
 * Restore an identity onto a new device from its recovery phrase.
 *
 * The word count is shown live because the most common failure is a phrase
 * that is short by one — far more common than a mistyped word, and invisible
 * without a counter. Real validation (checksum and wordlist) happens in
 * mnemonicToSeed; this only catches the obvious case early so the user is not
 * told "invalid phrase" when the real problem is that they pasted 23 words.
 */
export function RestoreIdentitySheet({
  visible,
  onClose,
  onRestored,
}: {
  visible: boolean
  onClose: () => void
  onRestored?: (did: string) => void
}) {
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Never leave a recovery phrase sitting in state after the sheet closes.
  useEffect(() => {
    if (!visible) {
      setPhrase('')
      setError(null)
    }
  }, [visible])

  const words = phrase.trim().split(/\s+/).filter(Boolean)
  const count = words.length
  const looksComplete = count === 24

  async function handleRestore() {
    setBusy(true)
    setError(null)
    try {
      const identity = await enrollFromMnemonic(words.join(' '))
      setPhrase('')
      onRestored?.(identity.did)
      onClose()
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'No se pudo restaurar.'
      setError(
        message === 'invalid mnemonic'
          ? 'Esa frase no es válida. Revisa el orden y la ortografía de cada palabra.'
          : message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} size="md" scroll>
      <View style={styles.header}>
        <Icon name="key" size={20} color={tokens.accent} />
        <Text style={styles.title}>Restaurar identidad</Text>
      </View>

      <Text style={styles.body}>
        Escribe las veinticuatro palabras que anotaste, separadas por espacios y
        en el mismo orden.
      </Text>

      <TextInput
        style={styles.input}
        value={phrase}
        onChangeText={setPhrase}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        editable={!busy}
        placeholder="palabra uno  palabra dos  palabra tres…"
        placeholderTextColor={tokens.muted}
        accessibilityLabel="Frase de recuperación"
      />

      <Text style={[styles.count, looksComplete && styles.countOk]}>
        {count} de 24 palabras
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[buttonStyle('primary'), (!looksComplete || busy) && styles.disabled]}
        disabled={!looksComplete || busy}
        onPress={handleRestore}
        accessibilityRole="button"
        accessibilityLabel="Restaurar mi identidad"
      >
        <Text style={buttonTextStyle('primary')}>
          {busy ? 'Restaurando…' : 'Restaurar'}
        </Text>
      </Pressable>
    </ResponsiveSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { color: tokens.text, fontSize: 18, fontWeight: '700' },
  body: { color: tokens.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  input: {
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.stroke,
    color: tokens.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
    padding: 12,
    textAlignVertical: 'top',
  },
  count: { color: tokens.muted, fontSize: 12, marginTop: 8, marginBottom: 14 },
  countOk: { color: tokens.accent },
  error: { color: tokens.danger, fontSize: 13, marginBottom: 12, lineHeight: 19 },
  disabled: { opacity: 0.5 },
})
