import {useState} from 'react'
import {View, Pressable, Text, StyleSheet} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Icon} from '../../../components/m8/Icon'
import {tokens} from '../../../theme'
import type {Persona} from '../../../types'
import type {NotificationItem} from '../../../hooks/useNotifications'

const HEADER_HEIGHT = 48

const personaColor: Record<string, string> = {
  anonymous: tokens.accent,
  public: tokens.success,
}

const severityTint: Record<string, { border: string; bg: string; text: string }> = {
  danger: { border: tokens.danger + '50', bg: tokens.danger + '12', text: tokens.danger },
  warning: { border: tokens.warning + '50', bg: tokens.warning + '12', text: tokens.warning },
  success: { border: tokens.success + '50', bg: tokens.success + '12', text: tokens.success },
  info: { border: tokens.glassBorderStrong, bg: tokens.surfaceRaised, text: tokens.text },
}

export function ConsoleHeader({
  notifications,
  badgeCount,
  hasDanger,
  personas,
  activePersonaId,
  onSelectPersona,
  onDismissNotification,
  onMarkNotificationsRead,
}: {
  notifications: NotificationItem[]
  badgeCount: number
  hasDanger: boolean
  personas: Persona[]
  activePersonaId: string
  onSelectPersona: (id: string) => void
  onDismissNotification?: (id: string) => void
  onMarkNotificationsRead?: () => void
}) {
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()

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
        <View style={styles.side}>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkI}>i</Text>M8
          </Text>
        </View>

        {/* Center: numbered identity selector */}
        <View style={styles.center}>
          <View style={styles.dotRow}>
            {personas.map((p, index) => {
              const active = p.id === activePersonaId
              const pColor = personaColor[p.kind] ?? tokens.accent
              return (
                <Pressable
                  key={p.id}
                  onPress={() => onSelectPersona(p.id)}
                  style={[
                    styles.dot,
                    {backgroundColor: pColor + '30'},
                    active && {borderColor: pColor + '90'},
                  ]}>
                  <Text style={[styles.dotText, {color: pColor}]}>
                    {index + 1}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.side}>
          <Pressable
            onPress={() => {
              setOpen((current) => {
                const next = !current
                if (next) onMarkNotificationsRead?.()
                return next
              })
            }}
            style={[styles.iconButton, open && styles.iconButtonActive]}
            hitSlop={8}>
            <Icon
              name={open || badgeCount > 0 ? 'bellFilled' : 'bell'}
              size={22}
              color={open ? tokens.accentSoft : hasDanger ? tokens.danger : badgeCount > 0 ? tokens.accentSoft : tokens.muted}
            />
            {badgeCount > 0 && !open && (
              <View style={[styles.badge, hasDanger && styles.badgeDanger]}>
                <Text style={styles.badgeText}>
                  {badgeCount > 9 ? '9+' : badgeCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Notification dropdown — floats below header */}
      {open && (
        <View style={[styles.dropdown, {top: headerFullHeight + 4}]}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>Inbox</Text>
            <Text style={styles.dropdownMeta}>
              {notifications.length === 0 ? 'Clear' : `${notifications.length} notice${notifications.length > 1 ? 's' : ''}`}
            </Text>
          </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: tokens.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  wordmarkI: {
    color: tokens.accentSoft,
    fontStyle: 'italic',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dotText: {
    fontSize: 12,
    fontWeight: '800',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: tokens.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
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
    left: 18,
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
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  dropdownTitle: {
    color: tokens.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dropdownMeta: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
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
