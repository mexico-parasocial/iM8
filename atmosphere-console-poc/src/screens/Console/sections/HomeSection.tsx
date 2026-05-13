import { Pressable, StyleSheet, Text, View } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { MiniStat, CoreRow, ListRow, EmptyState } from '../../../components/m8/ConsolePrimitives'
import type { IdentitySession, Persona, SurfaceId, NewSurfaceInput, GrantRequestInput } from '../../../types'
import { tokens } from '../../../theme'

export function HomeSection({
  session,
  activeSurface,
  activePersona,
  visibleRequests,
  commands,
  customSurfaces,
  onRequestGrant,
  onShowSurfaceBuilder,
  theme,
}: {
  session: IdentitySession
  activeSurface: SurfaceId
  activePersona: Persona | undefined
  visibleRequests: { id: string; appName: string; requestedClaims: string[]; audience: string; status: string }[]
  commands: { title: string; detail: string }[]
  customSurfaces: NewSurfaceInput[]
  onRequestGrant: (input: GrantRequestInput) => Promise<void>
  onShowSurfaceBuilder: () => void
  theme: typeof tokens
}) {
  const activeGrantCount = session.grants.filter((g) => g.status === 'Active').length
  const pendingGrantCount = session.pendingRequests.length

  return (
    <View style={styles.stack}>
      <View style={cardStyle('accent')}>
        <Text style={styles.summaryEyebrow}>Broker posture</Text>
        <Text style={styles.summaryTitle}>Your identity is verified. Apps only see what you approve.</Text>
        <Text style={styles.summaryBody}>
          {activeGrantCount} apps are actively requesting proofs. {pendingGrantCount} requests need your attention.
        </Text>
        <View style={styles.statRow}>
          <MiniStat label="Active" value={String(activeGrantCount)} />
          <MiniStat label="Pending" value={String(pendingGrantCount)} />
          <MiniStat label="Proofs" value={String(session.proofArtifacts.filter((a) => a.status === 'Active').length)} />
          <MiniStat label="Safety" value={session.pdsSafety.state} tone={
            session.pdsSafety.state === 'Backed up' ? 'success'
            : session.pdsSafety.state === 'Needs attention' ? 'warning'
            : 'danger'
          } />
        </View>
      </View>

      <View style={cardStyle('filled')}>
        <Text style={styles.summaryEyebrow}>Selected surface</Text>
        <Text style={styles.summaryTitle}>
          {activePersona?.name ?? 'Unknown'} is {(activePersona?.surfaceStates[activeSurface] ?? 'Muted').toLowerCase()} in {activeSurface}.
        </Text>
        <Text style={styles.summaryBody}>{activePersona?.summary ?? ''}</Text>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Identity core</Text>
        <CoreRow label="DID" value={shortDid(session.did)} />
        <CoreRow label="Auth server" value={new URL(session.authorizationServer).host} />
        <CoreRow label="Policy" value={session.paraProvider.policyRecord} />
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Incoming requests</Text>
        {visibleRequests.length > 0 ? (
          visibleRequests.map((request) => (
            <ListRow
              key={request.id}
              title={request.appName}
              detail={`${request.requestedClaims.length} claims · ${request.audience}`}
              meta={request.status}
            />
          ))
        ) : (
          <EmptyState
            icon="📭"
            title="No pending requests"
            detail={`${activeSurface} is ready. Apps will appear here when they need proofs.`}
          />
        )}
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Your surfaces</Text>
        {customSurfaces.length > 0 ? (
          customSurfaces.map((surface) => (
            <ListRow
              key={surface.id}
              title={surface.name}
              detail={surface.audience}
              meta={surface.status}
            />
          ))
        ) : (
          <EmptyState
            icon="🧩"
            title="No custom surfaces"
            detail="Create surfaces for specific contexts — work, anonymous posting, family, etc."
          />
        )}
        <Pressable
          onPress={onShowSurfaceBuilder}
          style={[buttonStyle('primary'), { marginTop: 8 }]}
        >
          <Text style={buttonTextStyle('primary')}>+ Create surface</Text>
        </Pressable>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Recommended</Text>
        {commands.map((cmd) => (
          <ListRow key={cmd.title} title={cmd.title} detail={cmd.detail} meta="Open" />
        ))}
      </View>
    </View>
  )
}

function shortDid(did: string) {
  if (did.length <= 18) return did
  return `${did.slice(0, 12)}...${did.slice(-4)}`
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    marginTop: 12,
  },
  listCard: {
    gap: 8,
  },
  listTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  summaryEyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  summaryTitle: {
    color: tokens.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  summaryBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 12,
  },
})
