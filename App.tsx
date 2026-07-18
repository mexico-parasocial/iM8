import {useEffect, useState} from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthScreen } from './src/screens/AuthScreen'
import { ConsoleScreen } from './src/screens/ConsoleScreen'
import { useSessionBootstrap } from './src/hooks/useSessionBootstrap'
import { useDeepLink, type DeepLinkRoute } from './src/hooks/useDeepLink'

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
  } = useSessionBootstrap()

  const {route, clear} = useDeepLink()
  const [pendingRoute, setPendingRoute] = useState<DeepLinkRoute>(null)

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

  const screen = session ? (
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
