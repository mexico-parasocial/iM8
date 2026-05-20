import { View, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon, type IconName } from '../../../components/m8/Icon'
import { tokens } from '../../../theme'
import { hapticMedium } from '../../../utils/haptics'

const SECTIONS: {
  id: string
  label: string
  icon: IconName
  iconActive: IconName
}[] = [
  { id: 'identity', label: 'Identity', icon: 'person', iconActive: 'personFilled' },
  { id: 'requests', label: 'Requests', icon: 'inbox', iconActive: 'bellFilled' },
  { id: 'para', label: 'PARA', icon: 'globe', iconActive: 'globeFilled' },
  { id: 'safety', label: 'Safety', icon: 'shieldCheck', iconActive: 'shieldCheckFilled' },
]

export function BottomNav({
  activeSection,
  onSectionChange,
}: {
  activeSection: string
  onSectionChange: (id: string) => void
}) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: clamp(insets.bottom, 6, 18),
        },
      ]}
    >
      {SECTIONS.map((section) => {
        const active = section.id === activeSection
        return (
          <Pressable
            key={section.id}
            onPress={() => {
              if (!active) hapticMedium()
              onSectionChange(section.id)
            }}
            style={[styles.tab, active && styles.tabActive]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Icon
              name={active ? section.iconActive : section.icon}
              size={20}
              color={active ? tokens.onAccent : tokens.muted}
            />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {section.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: tokens.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.glassBorderStrong,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 46,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: tokens.accent,
  },
  label: {
    color: tokens.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  labelActive: {
    color: tokens.onAccent,
  },
})
