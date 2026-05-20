import { Platform, Vibration } from 'react-native'

type HapticsModule = {
  ImpactFeedbackStyle: { Light: string; Medium: string; Heavy: string }
  NotificationFeedbackType: { Success: string; Warning: string; Error: string }
  impactAsync: (style: string) => Promise<void>
  notificationAsync: (type: string) => Promise<void>
}

let Haptics: HapticsModule | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require('expo-haptics') as HapticsModule
} catch {
  // expo-haptics not installed — fall back to Vibration API
}

export function hapticLight() {
  if (Haptics && Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  } else {
    Vibration.vibrate(10)
  }
}

export function hapticMedium() {
  if (Haptics && Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  } else {
    Vibration.vibrate(20)
  }
}

export function hapticSuccess() {
  if (Haptics && Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  } else {
    Vibration.vibrate(30)
  }
}
