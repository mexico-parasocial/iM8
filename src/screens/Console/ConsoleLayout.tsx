import { View, StyleSheet, RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated'
import { tokens } from '../../theme'

export const HEADER_HEIGHT = 52
export const BOTTOM_NAV_HEIGHT = 58

export function ConsoleLayout({
  children,
  header,
  footer,
  refreshing,
  onRefresh,
  scrollRef,
}: {
  children: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  refreshing: boolean
  onRefresh: () => void
  scrollRef?: React.RefObject<Animated.ScrollView | null>
}) {
  const insets = useSafeAreaInsets()
  const scrollY = useSharedValue(0)

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y
    },
  })

  const topPadding = header ? HEADER_HEIGHT + insets.top + 8 : insets.top + 16
  const bottomPadding = BOTTOM_NAV_HEIGHT + clamp(insets.bottom, 6, 18) + 8

  return (
    <View style={styles.shell}>
      {header}

      {/* Scrollable content */}
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPadding, paddingBottom: bottomPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.accent}
          />
        }
      >
        {children}
      </Animated.ScrollView>

      {/* Fixed bottom nav */}
      {footer}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
