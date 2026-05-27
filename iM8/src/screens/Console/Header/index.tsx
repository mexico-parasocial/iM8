import {useState} from 'react'
import {View, Pressable, Text, StyleSheet, Platform} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Icon} from '../../../components/m8/Icon'
import {tokens} from '../../../theme'
import type {Persona} from '../../../types'
import type {NotificationItem} from '../../../hooks/useNotifications'

const HEADER_HEIGHT = 48

const surfaceColor: Record<string, string> = {
  public: tokens.success,
  civic: tokens.accent,
  dating: '#a78bfa',
}

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identity',
  requests: 'Requests',
  para: 'PARA',
  safety: 'Safety',
}

const severityTint: Record<string, { border: string; bg: string; text: string }> = {
  danger: { border: tokens.danger + '50', bg: tokens.danger + '12', text: tokens.danger },
  warning: { border: tokens.warning + '50', bg: tokens.warning + '12', text: tokens.warning },
  success: { border: tokens.success + '50', bg: tokens.success + '12', text: tokens.success },
  info: { border: tokens.glassBorderStrong, bg: tokens.surfaceRaised, text: tokens.text },
}

export function ConsoleHeader({
  activeSection,
  notifications,
  badgeCount,
  hasDanger,
  personas,
  activePersonaId,
  onSelectPersona,
  onShowSettings,
  onDismissNotification,
}: {
  activeSection: string
  notifications: NotificationItem[]
  badgeCount: number
  hasDanger: boolean
  personas: Persona[]
  activePersonaId: string
  onSelectPersona: (id: string) => void
  onShowSettings?: () => void
  onDismissNotification?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const sColor = surfaceColor['public'] ?? tokens.accent

  const topOffset = insets.top
  const headerFullHeight = HEADER_HEIGHT + topOffset

  return (
    <>
      {/* Backdrop */}
      {open && (
        <Pressable
          style={[styles.backdrop, {top: headerFullHeight}]}
          onPress={() => setOpen(false)}
        />
      )}

      {/* Header bar */}
      <View style={[styles.bar, {height: headerFullHeight, paddingTop: topOffset}]}>
        {/* Bell */}
        <View style={styles.side}>
          <Pressable
            onPress={() => setOpen(s => !s)}
            style={styles.iconButton}
            hitSlop={8}>
            <Icon
              name={badgeCount > 0 ? 'bellFilled' : 'bell'}
              size={22}
              color={hasDanger ? tokens.danger : badgeCount > 0 ? tokens.text : tokens.muted}
            />
            {badgeCount > 0 && (
              <View style={[styles.badge, hasDanger && styles.badgeDanger]}>
                <Text style={styles.badgeText}>
                  {badgeCount > 9 ? '9+' : badgeCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Center: title + persona dots */}
        <View style={styles.center}>
          <Text style={styles.title}>{SECTION_LABELS[activeSection] ?? 'Console'}</Text>
          <View style={styles.dotRow}>
            {personas.map(p => {
              const active = p.id === activePersonaId
              return (
                <Pressable
                  key={p.id}
                  onPress={() => onSelectPersona(p.id)}
                  style={[
                    styles.dot,
                    {backgroundColor: sColor + '30'},
                    active && {borderColor: sColor + '90'},
                  ]}>
                  <Text style={[styles.dotText, {color: sColor}]}>
                    {p.id}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.side}>
          <Pressable
            onPress={onShowSettings}
            style={styles.iconButton}
            hitSlop={8}>
            <Icon name="settingsGear" size={22} color={tokens.muted} />
          </Pressable>
        </View>
      </View>

      {/* Notification dropdown — floats below header */}
      {open && (
        <View style={[styles.dropdown, {top: headerFullHeight + 4}]}>
          {notifications.length === 0 ? (
            <Text style={[styles.emptyNote, {color: tokens.muted}]}>
              No notifications
            </Text>
          ) : (
            notifications.map(n => {
              const tint = severityTint[n.severity] ?? severityTint.info
              return (
                <View
                  key={n.id}
                  style={[
                    styles.note,
                    {borderLeftColor: tint.border, backgroundColor: tint.bg},
                  ]}>
                  <View style={styles.noteIcon}>
                    <Icon name={n.icon} size={18} color={tint.text} />
                  </View>
                  <View style={{flex: 1, gap: 2}}>
                    <Text style={[styles.noteTitle, {color: tint.text}]}>
                      {n.title}
                    </Text>
                    {n.body && (
                      <Text style={[styles.noteBody, {color: tokens.muted}]}>
                        {n.body}
                      </Text>
                    )}
                    <View style={styles.noteFooter}>
                      <Text style={styles.noteTime}>{n.time}</Text>
                      {n.action && (
                        <Pressable
                          onPress={() => {
                            n.action!.onPress()
                            setOpen(false)
                          }}
                          style={styles.noteAction}>
                          <Text style={[styles.noteActionText, {color: tint.text}]}>
                            {n.action.label}
                          </Text>
                        </Pressable>
                      )}
                      {n.source === 'user' && onDismissNotification && (
                        <Pressable
                          onPress={() => onDismissNotification(n.id)}
                          style={styles.noteAction}>
                          <Text style={[styles.noteActionText, {color: tokens.muted}]}>
                            Dismiss
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: tokens.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.glassBorderStrong,
  },
  side: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: Platform.OS === 'ios' ? 'center' : 'flex-start',
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    color: tokens.text,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dotText: {
    fontSize: 10,
    fontWeight: '800',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeDanger: {
    backgroundColor: tokens.danger,
  },
  badgeText: {
    color: tokens.background,
    fontSize: 10,
    fontWeight: '800',
    includeFontPadding: false,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dropdown: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 11,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
    gap: 6,
    maxHeight: 400,
  },
  emptyNote: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  noteIcon: {
    marginTop: 2,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  noteBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  noteTime: {
    color: tokens.muted,
    fontSize: 11,
  },
  noteAction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: tokens.surface,
  },
  noteActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
})
