import { StyleSheet } from 'react-native'
import { tokens } from '../../theme'

export type CardVariant = 'elevated' | 'outlined' | 'filled' | 'accent' | 'danger' | 'warning'

const variantStyles: Record<CardVariant, object> = {
  elevated: {
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  filled: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  accent: {
    backgroundColor: tokens.accentTransparent,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
  },
  danger: {
    backgroundColor: tokens.dangerTransparent,
    borderWidth: 1,
    borderColor: tokens.dangerBorder,
  },
  warning: {
    backgroundColor: tokens.warningTransparent,
    borderWidth: 1,
    borderColor: tokens.warningBorder,
  },
}

export function cardStyle(variant: CardVariant = 'filled') {
  return {
    borderRadius: 18,
    padding: 16,
    gap: 8,
    ...variantStyles[variant],
  }
}

export const cardStyles = StyleSheet.create({
  base: {
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
})
