import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import {
  EmptyCard,
  Metric,
  NotificationCard,
  SectionHeading,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import type { AppGrant, ClaimRequest, IdentitySession, Persona } from '../../../types'
import type { NotificationItem } from '../../../hooks/useNotifications'
import { tokens } from '../../../theme'
import { consoleStyles } from '../styles'
import { GrantCard, RequestCard } from './RequestsSection'

export function HomeSection({
  activePersona,
  grants,
  isVerified,
  notifications,
  onApproveGrant,
  onDismissNotification,
  onGoToIdentity,
  onGoToSafety,
  onRevokeGrant,
  pendingRequests,
  session,
}: {
  activePersona: Persona | undefined
  grants: AppGrant[]
  isVerified: boolean
  notifications: NotificationItem[]
  onApproveGrant: (id: string) => Promise<void>
  onDismissNotification: (id: string) => void
  onGoToIdentity: () => void
  onGoToSafety: () => void
  onRevokeGrant: (id: string) => Promise<void>
  pendingRequests: ClaimRequest[]
  session: IdentitySession
}) {
  const activeLinks = (session.publicLinks ?? []).filter((link) => link.status === 'linked')
  const publicPersona = session.publicPersonaId
    ? session.personas.find((persona) => persona.id === session.publicPersonaId)
    : session.personas.find((persona) => persona.kind === 'public')
  const pendingRequestCount = pendingRequests.length
  const activeGrantCount = grants.filter((grant) => grant.status === 'Active').length

  return (
    <View style={consoleStyles.stack}>
      <View style={consoleStyles.heroCard}>
        <Text style={styles.eyebrow}>Dashboard</Text>
        <Text style={styles.heroTitle}>Your private root is the authority.</Text>
        <Text style={styles.heroBody}>
          Cards handle context. Public links stay explicit. Proof decisions stay in your inbox.
        </Text>
        <View style={consoleStyles.metricRow}>
          <Metric label="Cards" value={String(session.personas.length)} />
          <Metric label="Requests" value={String(pendingRequestCount)} />
          <Metric label="Active grants" value={String(activeGrantCount)} />
        </View>
      </View>

      <View style={styles.grid}>
        <DashboardCard
          action="Open wallet"
          icon="person"
          meta={activePersona?.kind === 'public' ? 'Public' : 'Anonymous'}
          onPress={onGoToIdentity}
          title={activePersona?.name ?? 'No card selected'}
        >
          <Text style={styles.cardBody}>
            {activePersona?.oneLine ?? 'Choose a card in Wallet. The private root is not shown as a profile.'}
          </Text>
        </DashboardCard>

        <DashboardCard
          action={pendingRequestCount > 0 ? 'Review below' : undefined}
          icon="inbox"
          meta={pendingRequestCount > 0 ? `${pendingRequestCount} pending` : 'Clear'}
          title="Proof decisions"
        >
          <Text style={styles.cardBody}>
            Ordinary app proof requests stay user-approved. Community governance lives in Wallet with PARA.
          </Text>
        </DashboardCard>

        <DashboardCard
          action="Open Safety"
          icon="shieldCheck"
          meta={activeLinks.length > 0 ? `${activeLinks.length} linked` : 'No public link'}
          onPress={onGoToSafety}
          title="Public exposure"
        >
          <Text style={styles.cardBody}>
            {publicPersona
              ? `${publicPersona.name} exists as an optional public card. Anonymous cards remain separate.`
              : 'No public identity is linked. Instagram, X, and Bluesky are empty until you choose them.'}
          </Text>
        </DashboardCard>

        <DashboardCard
          action="Open Wallet"
          icon="globe"
          meta={isVerified ? 'Ready' : 'Verify root'}
          onPress={onGoToIdentity}
          title="PARA readiness"
        >
          <Text style={styles.cardBody}>
            Selected cards can request proofs through the private root without exposing source documents.
          </Text>
        </DashboardCard>
      </View>

      {notifications.length > 0 ? (
        <View style={consoleStyles.listBlock}>
          <SectionHeading title="Inbox" detail="System notices and reminders that need attention." />
          {notifications.map((note) => (
            <NotificationCard
              key={note.id}
              notification={note}
              onDismissNotification={onDismissNotification}
            />
          ))}
        </View>
      ) : null}

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Pending approvals" detail="Apps receive proofs only after you approve." />
        {pendingRequests.length > 0 ? (
          pendingRequests.map((request) => (
            <RequestCard key={request.id} request={request} onApprove={onApproveGrant} />
          ))
        ) : (
          <EmptyCard icon="check" title="Nothing pending" body="New app requests will appear here with plain-language proof details." />
        )}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Grant receipts" detail="Every active or revoked permission stays visible." />
        {grants.map((grant) => (
          <GrantCard key={grant.id} grant={grant} onRevoke={onRevokeGrant} />
        ))}
      </View>
    </View>
  )
}

function DashboardCard({
  action,
  children,
  icon,
  meta,
  onPress,
  title,
}: {
  action?: string
  children: ReactNode
  icon: 'person' | 'inbox' | 'shieldCheck' | 'globe'
  meta: string
  onPress?: () => void
  title: string
}) {
  return (
    <View style={styles.card}>
      <View style={consoleStyles.rowBetween}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={18} color={tokens.accentSoft} />
        </View>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
      {action && onPress ? (
        <Pressable onPress={onPress} style={styles.linkButton}>
          <Text style={styles.linkText}>{action}</Text>
          <Icon name="chevronRight" size={14} color={tokens.accentSoft} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: tokens.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  heroBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  grid: {
    gap: 10,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accentTransparent,
  },
  meta: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
  },
  linkText: {
    color: tokens.accentSoft,
    fontSize: 12,
    fontWeight: '800',
  },
})
