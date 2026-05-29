export const palette = {
  background: '#111018',
  surface: '#1a1823',
  surfaceRaised: '#24212d',
  surfaceSoft: '#2b2834',
  stroke: '#474652',
  text: '#f4f1e8',
  muted: '#aaa4b6',
  accent: '#6f9f63',
  accentSoft: '#b5cfa5',
  onAccent: '#111018',
  success: '#84b979',
  onSuccess: '#111018',
  warning: '#d9b071',
  onWarning: '#111018',
  danger: '#ff7a86',
  onDanger: '#111018',
}

export type ColorToken = keyof typeof palette

export const tokens = {
  ...palette,
  accentTransparent: 'rgba(71, 70, 82, 0.46)',
  accentBorder: 'rgba(111, 159, 99, 0.24)',
  dangerTransparent: 'rgba(255, 122, 134, 0.08)',
  dangerBorder: 'rgba(255, 122, 134, 0.2)',
  warningTransparent: 'rgba(217, 176, 113, 0.12)',
  warningBorder: 'rgba(217, 176, 113, 0.2)',
  surfaceTransparent: 'rgba(244, 241, 232, 0.045)',
  // Glassmorphism
  glassBg: 'rgba(26, 24, 35, 0.72)',
  glassBorder: 'rgba(244, 241, 232, 0.08)',
  glassBorderStrong: 'rgba(244, 241, 232, 0.14)',
}

export const iosShadow = {
  shadowColor: '#000' as const,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.15,
  shadowRadius: 3,
  elevation: 3,
}

export type Token = keyof typeof tokens

export const colors = tokens

export function token(key: Token): string {
  return tokens[key]
}
