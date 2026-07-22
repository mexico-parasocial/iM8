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
  { id: 'dashboard', label: 'Dash', icon: 'home', iconActive: 'homeFilled' },
  { id: 'identity', label: 'Wallet', icon: 'person', iconActive: 'personFilled' },
  { id: 'settings', label: 'Settings', icon: 'settingsGear', iconActive: 'settingsGearFilled' },
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
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            onPress={() => {
              if (!active) hapticMedium()
              onSectionChange(section.id)
            }}
            style={styles.tab}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <View style={[styles.iconPill, active && styles.iconPillActive]}>
              <Icon
                name={active ? section.iconActive : section.icon}
                size={20}
                color={active ? tokens.onAccent : tokens.muted}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
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
    gap: 3,
    paddingVertical: 2,
  },
  iconPill: {
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 999,
  },
  iconPillActive: {
    backgroundColor: tokens.accent,
  },
  label: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: tokens.accentSoft,
  },
})
