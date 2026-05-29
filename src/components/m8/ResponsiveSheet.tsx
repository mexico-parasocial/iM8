import { type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { tokens } from '../../theme'

export type ResponsiveSheetSize = 'sm' | 'md' | 'lg'

const DESKTOP_BREAKPOINT = 768
const SHEET_WIDTHS: Record<ResponsiveSheetSize, number> = {
  sm: 420,
  md: 560,
  lg: 720,
}

export function useIsDesktopSheet() {
  const { width } = useWindowDimensions()
  return width >= DESKTOP_BREAKPOINT
}

export function ResponsiveSheet({
  actions,
  children,
  onClose,
  scroll = false,
  showHandle = true,
  size = 'md',
  visible,
}: {
  actions?: ReactNode
  children: ReactNode
  onClose: () => void
  scroll?: boolean
  showHandle?: boolean
  size?: ResponsiveSheetSize
  visible: boolean
}) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= DESKTOP_BREAKPOINT

  return (
    <Modal
      animationType={isDesktop ? 'fade' : 'slide'}
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isDesktop ? styles.overlayDesktop : styles.overlayMobile]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            isDesktop ? styles.sheetDesktop : styles.sheetMobile,
            isDesktop && { maxWidth: SHEET_WIDTHS[size], width: Math.max(width - 48, 0) },
          ]}
        >
          {showHandle ? <View style={[styles.handle, isDesktop && styles.handleDesktop]} /> : null}
          <View style={[styles.content, scroll && styles.contentScrollable]}>{children}</View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayDesktop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayMobile: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.background,
    overflow: 'hidden',
  },
  sheetDesktop: {
    maxHeight: '86%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.glassBorderStrong,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  sheetMobile: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.stroke,
    alignSelf: 'center',
    marginBottom: 16,
  },
  handleDesktop: {
    display: 'none',
  },
  content: {
    minHeight: 0,
  },
  contentScrollable: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
})
