import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { buttonStyle, buttonTextStyle } from './Button'
import { cardStyle } from './Card'
import { pillStyle, pillTextStyle } from './Pill'
import { tokens } from '../../theme'
import { type NewSurfaceInput, type SurfaceTrait } from '../../types'

const ALL_TRAITS: { id: SurfaceTrait; label: string; category: string }[] = [
  { id: 'discoverable', label: 'Discoverable', category: 'Visibility' },
  { id: 'portable', label: 'Portable across apps', category: 'Portability' },
  { id: 'low-friction', label: 'Low friction', category: 'UX' },
  { id: 'proof-first', label: 'Proof-first sharing', category: 'Privacy' },
  { id: 'policy-aware', label: 'Policy-aware', category: 'Privacy' },
  { id: 'trust-receipts', label: 'Trust receipts', category: 'Privacy' },
  { id: 'bounded-matching', label: 'Bounded matching', category: 'Matching' },
  { id: 'eligibility-safe', label: 'Eligibility-safe', category: 'Safety' },
  { id: 'revocable', label: 'Revocable anytime', category: 'Control' },
  { id: 'anonymous', label: 'Anonymous mode', category: 'Privacy' },
  { id: 'age-gated', label: 'Age-gated', category: 'Safety' },
  { id: 'location-scoped', label: 'Location-scoped', category: 'Safety' },
  { id: 'time-boxed', label: 'Time-boxed', category: 'Control' },
  { id: 'delegation-enabled', label: 'Delegation enabled', category: 'Control' },
]

const CATEGORIES = ['Privacy', 'Safety', 'Control', 'Visibility', 'Matching', 'Portability', 'UX']

export function SurfaceBuilderModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (input: NewSurfaceInput) => void
}) {
  const [name, setName] = useState('')
  const [audience, setAudience] = useState('')
  const [selectedTraits, setSelectedTraits] = useState<SurfaceTrait[]>([])
  const [activeCategory, setActiveCategory] = useState('Privacy')

  const toggleTrait = (trait: SurfaceTrait) => {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    )
  }

  const filteredTraits = ALL_TRAITS.filter((t) => t.category === activeCategory)

  const canCreate = name.trim().length > 0 && selectedTraits.length > 0

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

          <Text style={styles.title}>Create a surface</Text>
          <Text style={styles.subtitle}>
            Surfaces are contexts for sharing identity. Each gets its own rules.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.field}>
              <Text style={styles.label}>Surface name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="e.g. Work, Anonymous, Family"
                placeholderTextColor={tokens.muted}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Audience</Text>
              <TextInput
                value={audience}
                onChangeText={setAudience}
                style={styles.input}
                placeholder="Who sees this surface?"
                placeholderTextColor={tokens.muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Traits ({selectedTraits.length} selected)
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setActiveCategory(cat)}
                    style={[
                      pillStyle(activeCategory === cat ? 'accent' : 'muted'),
                      { paddingHorizontal: 14 },
                    ]}
                  >
                    <Text
                      style={pillTextStyle(
                        activeCategory === cat ? 'accent' : 'muted'
                      )}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.traitsGrid}>
                {filteredTraits.map((trait) => {
                  const selected = selectedTraits.includes(trait.id)
                  return (
                    <Pressable
                      key={trait.id}
                      onPress={() => toggleTrait(trait.id)}
                      style={[
                        styles.traitTile,
                        selected && {
                          backgroundColor: tokens.accentTransparent,
                          borderColor: tokens.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.traitText,
                          selected && { color: tokens.accentSoft, fontWeight: '800' },
                        ]}
                      >
                        {trait.label}
                      </Text>
                      {selected && (
                        <Text style={styles.traitCheck}>✓</Text>
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {selectedTraits.length > 0 && (
              <View style={[cardStyle('filled'), { marginTop: 8 }]}>
                <Text style={styles.previewTitle}>Preview</Text>
                <Text style={styles.previewName}>{name || 'Untitled'}</Text>
                <Text style={styles.previewAudience}>
                  {audience || 'No audience defined'}
                </Text>
                <View style={styles.previewTraits}>
                  {selectedTraits.map((trait) => (
                    <View key={trait} style={pillStyle('accent')}>
                      <Text style={pillTextStyle('accent')}>
                        {
                          ALL_TRAITS.find((t) => t.id === trait)?.label ??
                          trait
                        }
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onCreate({
                  id: `surface-${Date.now()}`,
                  name: name.trim(),
                  audience: audience.trim() || 'General',
                  traits: selectedTraits,
                  status: 'Live',
                })
                setName('')
                setAudience('')
                setSelectedTraits([])
                onClose()
              }}
              disabled={!canCreate}
              style={[buttonStyle('primary'), !canCreate && { opacity: 0.5 }]}
            >
              <Text style={buttonTextStyle('primary')}>Create surface</Text>
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
    maxHeight: '90%',
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
  scrollContent: {
    gap: 16,
    paddingBottom: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: tokens.text,
    fontSize: 13,
    fontWeight: '700',
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
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  traitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  traitTile: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  traitText: {
    color: tokens.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  traitCheck: {
    color: tokens.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  previewTitle: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  previewName: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '700',
  },
  previewAudience: {
    color: tokens.muted,
    fontSize: 13,
    marginTop: 4,
  },
  previewTraits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
})
