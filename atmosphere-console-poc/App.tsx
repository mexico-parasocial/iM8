import { useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthScreen } from './src/screens/AuthScreen'
import { ConsoleScreen } from './src/screens/ConsoleScreen'
import { OnboardingScreen } from './src/screens/OnboardingScreen'
import { useSessionBootstrap } from './src/hooks/useSessionBootstrap'

const ONBOARDING_KEY = 'm8_onboarding_complete'

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const {
    attempt,
    approveGrantRequest,
    createGrantRequest,
    error,
    isLoading,
    revokeExistingGrant,
    session,
    signIn,
    signOut,
    status,
  } = useSessionBootstrap()

  useState(() => {
    void AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setOnboardingDone(value === 'true')
    })
  })

  if (onboardingDone === null) {
    return null
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onDone={() => {
          void AsyncStorage.setItem(ONBOARDING_KEY, 'true')
          setOnboardingDone(true)
        }}
      />
    )
  }

  if (session) {
    return (
      <ConsoleScreen
        session={session}
        onApproveGrant={approveGrantRequest}
        onRequestGrant={createGrantRequest}
        onRevokeGrant={revokeExistingGrant}
        onSignOut={signOut}
      />
    )
  }

  return (
    <AuthScreen
      attempt={attempt}
      error={error}
      isLoading={isLoading}
      onSubmit={signIn}
      status={status}
    />
  )
}
