import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import {
  consoleStyles,
  StatusPill,
} from './ConsolePrimitives'
import { Icon } from './Icon'
import { tokens } from '../../theme'
import { cardStyle } from './Card'

export function ParaReadinessCard({
  action,
  children,
  icon = 'globe',
  meta,
  onPress,
  title,
}: {
  action?: string
  children: ReactNode
  icon?: 'person' | 'inbox' | 'shieldCheck' | 'globe'
  meta: string
  onPress?: () => void
  title: string
}) {
  return (
    <View style={cardStyle('accent')}>
      <View style={consoleStyles.rowBetween}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={18} color={tokens.accentSoft} />
        </View>
        <StatusPill label={meta} tone="success" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {children}
      {action && onPress ? (
        <Pressable onPress={onPress} style={styles.linkButton}>
          <Text style={styles.linkText}>{action}</Text>
          <Icon name="chevronRight" size={14} color={tokens.accentSoft} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accentTransparent,
  },
  title: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
  },
  linkText: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '800',
  },
})
