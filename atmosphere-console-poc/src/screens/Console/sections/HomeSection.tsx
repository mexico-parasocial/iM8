import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../../../components/m8/Icon'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { StatRow, CoreRow, ListRow, EmptyState } from '../../../components/m8/ConsolePrimitives'
import type { IdentitySession, Persona, SurfaceId, NewSurfaceInput, GrantRequestInput } from '../../../types'
import { tokens } from '../../../theme'

export function HomeSection({
  session,
  activeSurface,
  activePersona,
  ineVerified,
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
  ineVerified: boolean
  visibleRequests: { id: string; appName: string; requestedClaims: string[]; audience: string; status: string }[]
  commands: { title: string; detail: string }[]
  customSurfaces: NewSurfaceInput[]
  onRequestGrant: (input: GrantRequestInput) => Promise<void>
  onShowSurfaceBuilder: () => void
  theme: typeof tokens
}) {
  const activeGrantCount = session.grants.filter((g) => g.status === 'Active').length
  const pendingGrantCount = session.pendingRequests.length

  const surfaceColor: Record<string, string> = {
    public: theme.success,
    civic: theme.accent,
    dating: '#a78bfa',
  }
  const sColor = surfaceColor[activeSurface] ?? theme.accent

  return (
    <View style={styles.stack}>
      {/* Broker posture */}
      <View style={[styles.card, { backgroundColor: theme.accentTransparent }]}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2}}>
          <Text style={styles.eyebrow}>Broker posture</Text>
          {ineVerified && (
            <View style={[styles.verifiedBadge, { backgroundColor: theme.success + '18' }]}>
              <Icon name="shieldCheck" size={10} color={theme.success} />
              <Text style={[styles.verifiedText, { color: theme.success }]}>Verified</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle}>Your identity is verified. Apps only see what you approve.</Text>
        <Text style={styles.cardBody}>
          {activeGrantCount} apps are actively requesting proofs. {pendingGrantCount} requests need your attention.
        </Text>
        <StatRow stats={[
          { label: 'Active', value: String(activeGrantCount) },
          { label: 'Pending', value: String(pendingGrantCount) },
          { label: 'Proofs', value: String(session.proofArtifacts.filter((a) => a.status === 'Active').length) },
          { label: 'Safety', value: session.pdsSafety.state, tone:
            session.pdsSafety.state === 'Backed up' ? 'success'
            : session.pdsSafety.state === 'Needs attention' ? 'warning'
            : 'danger'
          },
        ]} />
      </View>

      {/* Surface state */}
      <View style={[styles.card, { backgroundColor: theme.surfaceTransparent }]}>
        <Text style={styles.eyebrow}>Selected surface</Text>
        <Text style={styles.cardTitle}>
          {activePersona?.name ?? 'Unknown'} is {(activePersona?.surfaceStates[activeSurface] ?? 'Muted').toLowerCase()} in {activeSurface}.
        </Text>
        <Text style={styles.cardBody}>{activePersona?.summary ?? ''}</Text>
      </View>

      {/* Identity core */}
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Identity core</Text>
        <CoreRow label="DID" value={shortDid(session.did)} />
        <CoreRow label="Auth server" value={new URL(session.authorizationServer).host} />
        <CoreRow label="Policy" value={session.paraProvider.policyRecord} />
      </View>

      {/* Incoming requests */}
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
            icon="inbox"
            title="No pending requests"
            detail={`${activeSurface} is ready. Apps will appear here when they need proofs.`}
          />
        )}
      </View>

      {/* Surfaces */}
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
            icon="home"
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

      {/* Recommended */}
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
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: tokens.success + '40',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  eyebrow: {
    color: tokens.accentSoft,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: tokens.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  cardBody: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
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
  statRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 10,
  },
})
