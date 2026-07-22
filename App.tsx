import {useEffect, useState} from 'react'
import {View} from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthScreen } from './src/screens/AuthScreen'
import { ConsoleScreen } from './src/screens/ConsoleScreen'
import { OnboardingScreen } from './src/screens/OnboardingScreen'
import { useSessionBootstrap } from './src/hooks/useSessionBootstrap'
import { useDeepLink, type DeepLinkRoute } from './src/hooks/useDeepLink'
import { tokens } from './src/theme'

const ONBOARDING_KEY = '@m8/onboarding-complete'

export default function App() {
  const {
    attempt,
    applyPolicyChange,
    approveGrantRequest,
    approvePolicyChange,
    createGrantRequest,
    createLocalIdentity,
    error,
    isLoading,
    createPublicPersona,
    linkPublicSocial,
    saveIneVerification,
    rejectPolicyChange,
    reloadSession,
    revokeExistingGrant,
    session,
    signIn,
    signOut,
    status,
    unlinkPublicSocial,
    updateDisplayName,
    updateSurfaceState,
  } = useSessionBootstrap()

  const {route, clear} = useDeepLink()
  const [pendingRoute, setPendingRoute] = useState<DeepLinkRoute>(null)
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => setOnboardingDone(value === 'true'))
      // Fail open: never trap a user on onboarding because storage errored.
      .catch(() => setOnboardingDone(true))
  }, [])

  useEffect(() => {
    if (!route) return
    if (!session) {
      setPendingRoute(route)
    }
  }, [route, session])

  const incomingRoute = session ? route ?? pendingRoute : null

  const handleRouteHandled = () => {
    clear()
    setPendingRoute(null)
  }

  const completeOnboarding = () => {
    setOnboardingDone(true)
    void AsyncStorage.setItem(ONBOARDING_KEY, 'true')
  }

  const screen =
    onboardingDone === null ? (
      <View style={{flex: 1, backgroundColor: tokens.background}} />
    ) : !onboardingDone ? (
      <OnboardingScreen onDone={completeOnboarding} />
    ) : session ? (
    <ConsoleScreen
      session={session}
      incomingRoute={incomingRoute}
      onRouteHandled={handleRouteHandled}
      onApproveGrant={approveGrantRequest}
      onApprovePolicyChange={approvePolicyChange}
      onApplyPolicyChange={applyPolicyChange}
      onRequestGrant={createGrantRequest}
      onRejectPolicyChange={rejectPolicyChange}
      onRevokeGrant={revokeExistingGrant}
      onSaveIneVerification={saveIneVerification}
      onCreatePublicPersona={createPublicPersona}
      onLinkPublicSocial={linkPublicSocial}
      onSignOut={signOut}
      onUnlinkPublicSocial={unlinkPublicSocial}
      onUpdateDisplayName={updateDisplayName}
      onUpdateSurfaceState={updateSurfaceState}
      onRefreshSession={reloadSession}
    />
  ) : (
    <AuthScreen
      attempt={attempt}
      error={error}
      isLoading={isLoading}
      onCreateLocal={createLocalIdentity}
      onSubmit={signIn}
      status={status}
    />
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>{screen}</SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
