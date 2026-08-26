import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  consoleStyles,
  SectionHeading,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import type { NotificationItem } from '../../../hooks/useNotifications'
import { tokens } from '../../../theme'

const severityTint: Record<string, { border: string; bg: string; text: string }> = {
  danger: { border: tokens.danger + '50', bg: tokens.danger + '12', text: tokens.danger },
  warning: { border: tokens.warning + '50', bg: tokens.warning + '12', text: tokens.warning },
  success: { border: tokens.success + '50', bg: tokens.success + '12', text: tokens.success },
  info: { border: tokens.glassBorderStrong, bg: tokens.surfaceRaised, text: tokens.text },
}

export function InboxSection({
  notifications,
  onDismissNotification,
  onBack,
}: {
  notifications: NotificationItem[]
  onDismissNotification: (id: string) => void
  onBack: () => void
}) {
  return (
    <View style={consoleStyles.stack}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Icon name="chevronLeft" size={16} color={tokens.accentSoft} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <SectionHeading
        title="Inbox"
        detail={`${notifications.length} notification${notifications.length !== 1 ? 's' : ''}.`}
      />

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bell" size={32} color={tokens.muted} />
          <Text style={styles.emptyText}>All clear</Text>
        </View>
      ) : (
        <>
          {notifications.map((n) => {
            const tint = severityTint[n.severity] ?? severityTint.info
            return (
              <View
                key={n.id}
                style={[styles.card, { borderLeftColor: tint.border, backgroundColor: tint.bg }]}>
                <View style={styles.cardRow}>
                  <View style={styles.iconWrap}>
                    <Icon name={n.icon} size={18} color={tint.text} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.cardTitle, { color: tint.text }]}>{n.title}</Text>
                    {n.body && (
                      <Text style={styles.cardBody}>{n.body}</Text>
                    )}
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardTime}>{n.time}</Text>
                      {n.action && (
                        <Pressable
                          onPress={n.action.onPress}
                          style={styles.actionButton}>
                          <Text style={[styles.actionText, { color: tint.text }]}>
                            {n.action.label}
                          </Text>
                        </Pressable>
                      )}
                      {n.source === 'user' && (
                        <Pressable
                          onPress={() => onDismissNotification(n.id)}
                          style={styles.actionButton}>
                          <Text style={[styles.actionText, { color: tokens.muted }]}>
                            Dismiss
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )
          })}
          <View style={styles.footer}>
            <Icon name="check" size={14} color={tokens.muted} />
            <Text style={styles.footerText}>That's all</Text>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    color: tokens.accentSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: tokens.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    marginTop: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  cardTime: {
    color: tokens.muted,
    fontSize: 11,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: tokens.surface,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  footerText: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '600',
  },
})
