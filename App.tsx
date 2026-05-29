import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthScreen } from './src/screens/AuthScreen'
import { ConsoleScreen } from './src/screens/ConsoleScreen'
import { useSessionBootstrap } from './src/hooks/useSessionBootstrap'

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
    revokeExistingGrant,
    session,
    signIn,
    signOut,
    status,
    unlinkPublicSocial,
    updateDisplayName,
  } = useSessionBootstrap()

  const screen = session ? (
    <ConsoleScreen
      session={session}
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
