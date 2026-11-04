import { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { consoleStyles, SectionHeading } from '../../../components/m8/ConsolePrimitives'
import {
  approveMatrixSignRequest,
  listPendingMatrixSignRequests,
  type MatrixSignRequest,
  type SigningIdentity,
} from '../../../services/matrixSignRequest'
import { tokens } from '../../../theme'

const AUDIENCE_LABELS: Record<string, string> = {
  'para-matrix-bridge/identity.v1': 'Verificar tu identidad de chat',
  'para-matrix-bridge/session.v1': 'Iniciar sesión de chat',
  'para-matrix-bridge/attest.v1': 'Registrar este dispositivo de chat',
  'para-matrix-bridge/join.v1': 'Entrar a una comunidad',
}

export function MatrixSignRequests({ hasPublicIdentity }: { hasPublicIdentity: boolean }) {
  const [requests, setRequests] = useState<MatrixSignRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRequests(await listPendingMatrixSignRequests())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 3000)
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [refresh])

  const approve = async (id: string, identity: SigningIdentity) => {
    setApprovingId(id)
    setError(null)
    try {
      await approveMatrixSignRequest(id, identity)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <View style={consoleStyles.listBlock}>
      <SectionHeading title={`Firmas de chat pendientes · ${requests.length}`} detail="PARA pide cada firma por separado. Elige qué identidad usar antes de aprobar." />
      {error ? <Text style={{ color: tokens.danger }}>{error}</Text> : null}
      {requests.map(request => (
        <View key={request.id} style={[consoleStyles.surfaceCard, { gap: 10 }]}>
          <Text style={consoleStyles.cardTitle}>{AUDIENCE_LABELS[request.audience] ?? request.audience}</Text>
          <Text style={consoleStyles.cardBodyText}>PARA · vence a las {new Date(request.expiresAt.replace(' ', 'T') + 'Z').toLocaleTimeString()}</Text>
          {AUDIENCE_LABELS[request.audience] ? <View style={{ flexDirection: 'row', gap: 8 }}>
            {hasPublicIdentity ? (
              <Pressable accessibilityRole="button" disabled={approvingId !== null} onPress={() => void approve(request.id, 'public')} style={buttonStyle('primary')}>
                <Text style={buttonTextStyle('primary')}>Aprobar como pública</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" disabled={approvingId !== null} onPress={() => void approve(request.id, 'anonymous')} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>Aprobar como anónima</Text>
            </Pressable>
          </View> : <Text style={{ color: tokens.danger }}>Solicitud desconocida; no se puede aprobar.</Text>}
        </View>
      ))}
    </View>
  )
}
