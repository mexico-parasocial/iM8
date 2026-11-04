import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from './Button'
import { ResponsiveSheet } from './ResponsiveSheet'
import { tokens } from '../../theme'

/**
 * Confirm-send sheet: message 2FA.
 *
 * Shows the approval code for exactly one message (room + body preview).
 * Approving returns the already-built approval to the caller — the sheet
 * never signs; the composer builds the approval via messageApproval.ts
 * and attaches it on approve. Denying discards it.
 *
 * Wired by the future message composer (Phase B); shipped now so the
 * gate UI is reviewed alongside the gate logic it fronts.
 */
export function ConfirmSendSheet({
  visible,
  roomLabel,
  bodyPreview,
  code,
  busy,
  onApprove,
  onDeny,
}: {
  visible: boolean
  roomLabel: string
  bodyPreview: string
  code: string
  busy: boolean
  onApprove: () => void
  onDeny: () => void
}) {
  return (
    <ResponsiveSheet
      visible={visible}
      onClose={onDeny}
      size="md"
      actions={
        <>
          <Pressable
            onPress={onDeny}
            disabled={busy}
            style={buttonStyle('secondary')}
            accessibilityRole="button"
            accessibilityLabel="Deny send"
          >
            <Text style={buttonTextStyle('secondary')}>Deny</Text>
          </Pressable>
          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={buttonStyle('primary')}
            accessibilityRole="button"
            accessibilityLabel={`Approve send with code ${code}`}
          >
            {busy ? (
              <ActivityIndicator color={tokens.onAccent} />
            ) : (
              <Text style={buttonTextStyle('primary')}>Approve and send</Text>
            )}
          </Pressable>
        </>
      }
    >
      <Text style={styles.title}>Confirm send</Text>
      <Text style={styles.subtitle}>
        This code approves this message only — to this room, with this text.
      </Text>
      <View style={styles.previewCard}>
        <Text style={styles.roomLabel}>{roomLabel}</Text>
        <Text style={styles.bodyPreview} numberOfLines={3}>
          {bodyPreview}
        </Text>
      </View>
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Approval code</Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
      </View>
    </ResponsiveSheet>
  )
}

const styles = StyleSheet.create({
  title: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  previewCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
    backgroundColor: tokens.surface,
    padding: 14,
    gap: 4,
  },
  roomLabel: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  bodyPreview: {
    color: tokens.text,
    fontSize: 14,
    lineHeight: 20,
  },
  codeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
    backgroundColor: tokens.accentTransparent,
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  code: {
    color: tokens.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
  },
})
