import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthScreen } from './src/screens/AuthScreen'
import { ConsoleScreen } from './src/screens/ConsoleScreen'
import { useSessionBootstrap } from './src/hooks/useSessionBootstrap'

export default function App() {
  const {
    attempt,
    approveGrantRequest,
    createGrantRequest,
    createLocalIdentity,
    error,
    isLoading,
    saveIneVerification,
    revokeExistingGrant,
    session,
    signIn,
    signOut,
    status,
    updateDisplayName,
  } = useSessionBootstrap()

  const screen = session ? (
    <ConsoleScreen
      session={session}
      onApproveGrant={approveGrantRequest}
      onRequestGrant={createGrantRequest}
      onRevokeGrant={revokeExistingGrant}
      onSaveIneVerification={saveIneVerification}
      onSignOut={signOut}
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
