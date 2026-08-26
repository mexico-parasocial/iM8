import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SectionHeading, StatusPill } from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { tokens } from '../../../theme'
import type { Persona, Signal, SurfaceId, SurfaceTemplate, NewSurfaceInput } from '../../../types'

type SurfaceInput = SurfaceTemplate | NewSurfaceInput

const CIVIC_CATEGORIES = [
  { id: 'public-services', label: 'Public Services', icon: 'heart', color: '#0EA5E9' },
  { id: 'internal-revenue', label: 'Internal Revenue', icon: 'landmark', color: '#8B5CF6' },
  { id: 'economy', label: 'Economy', icon: 'trending', color: '#22C55E' },
  { id: 'internal-affairs', label: 'Internal Affairs', icon: 'shield', color: '#F59E0B' },
  { id: 'external-affairs', label: 'External Affairs', icon: 'globe', color: '#6366F1' },
  { id: 'social-issues', label: 'Social Issues', icon: 'users', color: '#EC4899' },
] as const

type CategoryId = typeof CIVIC_CATEGORIES[number]['id']

const CATEGORY_INTERESTS: Record<CategoryId, string[]> = {
  'public-services': ['Healthcare', 'Education', 'Infrastructure', 'Public Transport', 'Water & Sanitation'],
  'internal-revenue': ['Tax Reform', 'Fiscal Transparency', 'Public Debt', 'Audit & Accountability', 'Tax Evasion'],
  economy: ['Employment', 'Inflation', 'Trade Policy', 'Minimum Wage', 'Small Business'],
  'internal-affairs': ['Security', 'Justice Reform', 'Corruption', 'Civil Rights', 'Indigenous Rights'],
  'external-affairs': ['Diplomacy', 'Migration', 'Trade Agreements', 'Border Policy', 'International Aid'],
  'social-issues': ['Gender Equality', 'LGBTQ+ Rights', 'Disability Rights', 'Housing', 'Environmental Justice'],
}

function CategoryCard({
  category,
  signalCount,
  activeCount,
  onPress,
}: {
  category: typeof CIVIC_CATEGORIES[number]
  signalCount: number
  activeCount: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.categoryCard}
      accessibilityRole="button"
    >
      <View style={[styles.categoryAccent, { backgroundColor: category.color }]} />
      <View style={styles.categoryIconWrap}>
        <Icon name={category.icon as any} size={18} color={category.color} />
      </View>
      <View style={styles.categoryContent}>
        <Text style={styles.categoryLabel}>{category.label}</Text>
        <Text style={styles.categoryCount}>
          {activeCount}/{signalCount} interests
        </Text>
      </View>
      <View style={styles.categoryArrow}>
        <Icon name="chevronRight" size={14} color={tokens.muted} />
      </View>
    </Pressable>
  )
}

function SignalRow({
  signal,
  assigned,
  surfaceId,
  categoryColor,
  onToggle,
}: {
  signal: Signal
  assigned: boolean
  surfaceId: SurfaceId | null
  categoryColor: string
  onToggle: () => void
}) {
  return (
    <View style={styles.signalRow}>
      <View style={[styles.signalAccent, { backgroundColor: categoryColor }]} />
      <View style={styles.signalContent}>
        <View style={styles.signalHeader}>
          <Text style={styles.signalLabel}>{signal.label}</Text>
          <StatusPill
            label={signal.visibility}
            tone={signal.visibility === 'Private' ? 'danger' : signal.visibility === 'Trusted only' ? 'warning' : 'success'}
          />
        </View>
        <Text style={styles.signalValue}>{signal.value}</Text>
      </View>
      {surfaceId && (
        <Switch
          value={assigned}
          onValueChange={onToggle}
          trackColor={{ false: tokens.stroke, true: categoryColor }}
          thumbColor={assigned ? tokens.text : tokens.muted}
        />
      )}
    </View>
  )
}

function InterestRow({
  label,
  assigned,
  surfaceId,
  categoryColor,
  onToggle,
}: {
  label: string
  assigned: boolean
  surfaceId: SurfaceId | null
  categoryColor: string
  onToggle: () => void
}) {
  return (
    <View style={styles.signalRow}>
      <View style={[styles.signalAccent, { backgroundColor: categoryColor }]} />
      <View style={styles.signalContent}>
        <Text style={styles.signalLabel}>{label}</Text>
      </View>
      {surfaceId && (
        <Switch
          value={assigned}
          onValueChange={onToggle}
          trackColor={{ false: tokens.stroke, true: categoryColor }}
          thumbColor={assigned ? tokens.text : tokens.muted}
        />
      )}
    </View>
  )
}

export function SurfaceFieldBrowser({
  surface,
  persona,
  surfaceId,
  onToggleSignalSurface,
}: {
  surface: SurfaceInput
  persona: Persona
  surfaceId: SurfaceId | null
  onToggleSignalSurface: (signalLabel: string, surfaceId: SurfaceId) => void
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null)

  const activeCat = CIVIC_CATEGORIES.find((c) => c.id === activeCategory)

  const categoryInterests = activeCategory
    ? CATEGORY_INTERESTS[activeCategory]
    : []

  const getCategoryCounts = (catId: CategoryId) => {
    const interests = CATEGORY_INTERESTS[catId]
    // For now, count all interests as available (would need interest assignment tracking)
    return { total: interests.length, active: 0 }
  }

  if (activeCategory && activeCat) {
    return (
      <View style={styles.container}>
        <Pressable
          onPress={() => setActiveCategory(null)}
          style={styles.backButton}
        >
          <Icon name="chevronLeft" size={16} color={tokens.accent} />
          <Text style={styles.backText}>All categories</Text>
        </Pressable>

        <View style={styles.categoryHero}>
          <View style={[styles.categoryHeroIcon, { backgroundColor: activeCat.color + '20' }]}>
            <Icon name={activeCat.icon as any} size={24} color={activeCat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.categoryHeroTitle}>{activeCat.label}</Text>
            <Text style={styles.categoryHeroDetail}>
              {categoryInterests.length} interests to follow
            </Text>
          </View>
        </View>

        <ScrollView style={styles.signalList} showsVerticalScrollIndicator={false}>
          {categoryInterests.map((interest) => (
            <InterestRow
              key={interest}
              label={interest}
              assigned={false}
              surfaceId={surfaceId}
              categoryColor={activeCat.color}
              onToggle={() => {
                // TODO: track interest assignments per surface
              }}
            />
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SectionHeading
        title="Civic categories"
        detail="Choose which policy areas to follow on this surface."
      />
      <View style={styles.categoryGrid}>
        {CIVIC_CATEGORIES.map((cat) => {
          const counts = getCategoryCounts(cat.id)
          return (
            <CategoryCard
              key={cat.id}
              category={cat}
              signalCount={counts.total}
              activeCount={counts.active}
              onPress={() => setActiveCategory(cat.id)}
            />
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  backText: {
    color: tokens.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tokens.surfaceTransparent,
  },
  categoryHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeroTitle: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  categoryHeroDetail: {
    color: tokens.muted,
    fontSize: 13,
    marginTop: 2,
  },
  categoryGrid: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tokens.surfaceTransparent,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  categoryAccent: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  categoryContent: {
    flex: 1,
    gap: 2,
  },
  categoryLabel: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  categoryCount: {
    color: tokens.muted,
    fontSize: 12,
  },
  categoryArrow: {
    padding: 4,
  },
  signalList: {
    maxHeight: 400,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tokens.surfaceTransparent,
    marginBottom: 8,
  },
  signalAccent: {
    width: 3,
    height: 28,
    borderRadius: 1.5,
  },
  signalContent: {
    flex: 1,
    gap: 4,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalLabel: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '600',
  },
  signalValue: {
    color: tokens.muted,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyText: {
    color: tokens.muted,
    fontSize: 14,
    textAlign: 'center',
  },
})
