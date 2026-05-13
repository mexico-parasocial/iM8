export const palette = {
  background: '#07111f',
  surface: '#0f1c30',
  surfaceRaised: '#16263f',
  surfaceSoft: '#11233a',
  stroke: '#213956',
  text: '#f4f7fb',
  muted: '#9cb3cb',
  accent: '#4fa7ff',
  accentSoft: '#d7ebff',
  onAccent: '#07111f',
  success: '#5fd6b2',
  onSuccess: '#07111f',
  warning: '#ffbe63',
  onWarning: '#07111f',
  danger: '#ff8d8d',
  onDanger: '#07111f',
}

type ColorToken = keyof typeof palette

export const tokens = {
  ...palette,
  accentTransparent: 'rgba(79, 167, 255, 0.08)',
  accentBorder: 'rgba(79, 167, 255, 0.18)',
  dangerTransparent: 'rgba(255, 141, 141, 0.08)',
  dangerBorder: 'rgba(255, 141, 141, 0.2)',
  warningTransparent: 'rgba(255, 190, 99, 0.12)',
  warningBorder: 'rgba(255, 190, 99, 0.2)',
  surfaceTransparent: 'rgba(255, 255, 255, 0.04)',
}

export type Token = keyof typeof tokens

export function token(key: Token): string {
  return tokens[key]
}
