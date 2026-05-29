import { View, Pressable, StyleSheet } from 'react-native'
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
  { id: 'dashboard', label: 'Dash', icon: 'home', iconActive: 'homeFilled' },
  { id: 'identity', label: 'Wallet', icon: 'person', iconActive: 'personFilled' },
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
            accessibilityLabel={section.label}
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
    minHeight: 46,
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: tokens.accent,
  },
})
