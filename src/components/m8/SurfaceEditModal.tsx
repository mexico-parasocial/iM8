import { useState, useEffect } from 'react'
import {
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
import { ResponsiveSheet } from './ResponsiveSheet'
import { tokens } from '../../theme'
import type { Persona, SurfaceId, SurfaceTemplate, NewSurfaceInput } from '../../types'
import { SurfaceFieldBrowser } from '../../screens/Console/sections/SurfaceFieldBrowser'

type SurfaceInput = SurfaceTemplate | NewSurfaceInput

const CATEGORIES = ['Privacy', 'Safety', 'Control', 'Visibility', 'Matching', 'Portability', 'UX']

const TRAIT_LABELS: Record<string, string> = {
  discoverable: 'Discoverable',
  portable: 'Portable across apps',
  lowfriction: 'Low friction',
  prooffirst: 'Proof-first sharing',
  policyaware: 'Policy-aware',
  trustreceipts: 'Trust receipts',
  boundedmatching: 'Bounded matching',
  eligibilitysafe: 'Eligibility-safe',
  revocable: 'Revocable anytime',
  anonymous: 'Anonymous mode',
  agegated: 'Age-gated',
  locationscoped: 'Location-scoped',
  timeboxed: 'Time-boxed',
  delegationenabled: 'Delegation enabled',
}

const TRAIT_TO_CATEGORY: Record<string, string> = {
  discoverable: 'Visibility',
  portable: 'Portability',
  lowfriction: 'UX',
  prooffirst: 'Privacy',
  policyaware: 'Privacy',
  trustreceipts: 'Privacy',
  boundedmatching: 'Matching',
  eligibilitysafe: 'Safety',
  revocable: 'Control',
  anonymous: 'Privacy',
  agegated: 'Safety',
  locationscoped: 'Safety',
  timeboxed: 'Control',
  delegationenabled: 'Control',
}

export function SurfaceEditModal({
  visible,
  surface,
  persona,
  surfaceId,
  onToggleSignalSurface,
  onClose,
  onSave,
}: {
  visible: boolean
  surface: SurfaceInput | null
  persona: Persona | null
  surfaceId: SurfaceId | null
  onToggleSignalSurface: (signalLabel: string, surfaceId: SurfaceId) => void
  onClose: () => void
  onSave: (id: string, updates: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [audience, setAudience] = useState('')
  const [detail, setDetail] = useState('')
  const [selectedTraits, setSelectedTraits] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('Privacy')

  useEffect(() => {
    if (surface) {
      setName(surface.name)
      setAudience(surface.audience)
      setDetail('detail' in surface ? (surface.detail ?? '') : '')
      setSelectedTraits(
        'traits' in surface ? (surface.traits as string[]) : []
      )
    }
  }, [surface])

  const toggleTrait = (trait: string) => {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    )
  }

  const filteredTraits = Object.entries(TRAIT_LABELS)
    .filter(([id]) => TRAIT_TO_CATEGORY[id] === activeCategory)
    .map(([id, label]) => ({ id, label }))

  const canSave = name.trim().length > 0

  if (!surface) return null

  return (
    <ResponsiveSheet
      visible={visible}
      onClose={onClose}
      size="md"
      scroll
      actions={
        <>
          <Pressable onPress={onClose} style={buttonStyle('secondary')}>
            <Text style={buttonTextStyle('secondary')}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onSave(surface.id, {
                name: name.trim(),
                audience: audience.trim() || surface.audience,
                detail: detail.trim() || undefined,
                traits: selectedTraits as any,
              })
              onClose()
            }}
            disabled={!canSave}
            style={[buttonStyle('primary'), !canSave && { opacity: 0.5 }]}
          >
            <Text style={buttonTextStyle('primary')}>Save changes</Text>
          </Pressable>
        </>
      }
    >
      <Text style={styles.title}>Edit {surface.name}</Text>
      <Text style={styles.subtitle}>
        Customize what this surface shares and how it appears.
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
          <Text style={styles.label}>Detail</Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Describe what this surface is for"
            placeholderTextColor={tokens.muted}
            multiline
          />
        </View>

        {persona && surfaceId && (
          <SurfaceFieldBrowser
            surface={surface}
            persona={persona}
            surfaceId={surfaceId}
            onToggleSignalSurface={onToggleSignalSurface}
          />
        )}

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

        <View style={[cardStyle('filled'), { marginTop: 8 }]}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Text style={styles.previewName}>{name || 'Untitled'}</Text>
          <Text style={styles.previewAudience}>
            {audience || 'No audience defined'}
          </Text>
          {detail ? (
            <Text style={styles.previewDetail}>{detail}</Text>
          ) : null}
          {selectedTraits.length > 0 && (
            <View style={styles.previewTraits}>
              {selectedTraits.map((trait) => (
                <View key={trait} style={pillStyle('accent')}>
                  <Text style={pillTextStyle('accent')}>
                    {TRAIT_LABELS[trait] ?? trait}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
  hint: {
    color: tokens.muted,
    fontSize: 11,
    marginTop: -4,
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
  previewDetail: {
    color: tokens.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  previewTraits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
})
