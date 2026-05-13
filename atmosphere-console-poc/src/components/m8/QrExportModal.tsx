import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { buttonStyle, buttonTextStyle } from './Button'
import { cardStyle } from './Card'
import { tokens } from '../../theme'
import { type Persona } from '../../types'

// Stub QR display — in production, use react-native-qrcode-svg or similar
export function QrExportModal({
  visible,
  onClose,
  persona,
  did,
}: {
  visible: boolean
  onClose: () => void
  persona: Persona | undefined
  did: string
}) {
  const [showRaw, setShowRaw] = useState(false)

  if (!persona) return null

  const publicTraits = persona.signals
    .filter((s) => s.visibility === 'Public')
    .map((s) => s.label)
    .join(', ')

  const qrPayload = JSON.stringify({
    v: 1,
    did,
    persona: {
      name: persona.name,
      role: persona.role,
      traits: publicTraits,
    },
  })

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>📤 Export Persona</Text>
          <Text style={styles.subtitle}>
            Other m8 users can scan this to request a connection. Only public traits are shared.
          </Text>

          <View style={styles.qrCard}>
            {/* QR Code Placeholder */}
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrEmoji}>🔲</Text>
              <Text style={styles.qrLabel}>QR Code</Text>
              <Text style={styles.qrHint}>{qrPayload.length} bytes encoded</Text>
            </View>

            <View style={styles.personaSummary}>
              <Text style={styles.summaryName}>{persona.name}</Text>
              <Text style={styles.summaryRole}>{persona.role}</Text>
              {publicTraits ? (
                <Text style={styles.summaryTraits}>🌐 {publicTraits}</Text>
              ) : (
                <Text style={styles.summaryTraitsMuted}>No public traits set</Text>
              )}
            </View>
          </View>

          <Pressable onPress={() => setShowRaw(!showRaw)} style={styles.rawToggle}>
            <Text style={styles.rawToggleText}>{showRaw ? 'Hide raw data' : 'Show raw data'}</Text>
          </Pressable>

          {showRaw && (
            <View style={cardStyle('filled')}>
              <ScrollView style={styles.rawScroll}>
                <Text style={styles.rawText}>{qrPayload}</Text>
              </ScrollView>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={buttonStyle('primary')}>
              <Text style={buttonTextStyle('primary')}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: tokens.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.stroke,
    alignSelf: 'center',
    marginBottom: 16,
  },
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
    marginBottom: 20,
  },
  qrCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
    alignItems: 'center',
    gap: 16,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 16,
    backgroundColor: tokens.background,
    borderWidth: 2,
    borderColor: tokens.stroke,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrEmoji: {
    fontSize: 48,
  },
  qrLabel: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  qrHint: {
    color: tokens.muted,
    fontSize: 12,
  },
  personaSummary: {
    alignItems: 'center',
    gap: 4,
  },
  summaryName: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '700',
  },
  summaryRole: {
    color: tokens.muted,
    fontSize: 14,
  },
  summaryTraits: {
    color: tokens.success,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  summaryTraitsMuted: {
    color: tokens.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  rawToggle: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  rawToggleText: {
    color: tokens.accentSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  rawScroll: {
    maxHeight: 120,
  },
  rawText: {
    color: tokens.muted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  actions: {
    marginTop: 16,
  },
})
