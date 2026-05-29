import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  EmptyCard,
  Metric,
  SectionHeading,
  SectionHero,
  SimpleFact,
  SimpleRow,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { tokens } from '../../../theme'
import type { AdminApproval, CommunityAdmin, IdentitySession, PolicyChangeRequest, ProofArtifact } from '../../../types'
import { CLAIM_LABELS } from '../constants'
import { consoleStyles } from '../styles'

export function ParaSection({
  embedded = false,
  isVerified,
  onApprovePolicyChange,
  onApplyPolicyChange,
  onRejectPolicyChange,
  onRequestParaGrant,
  onStartVerification,
  proofArtifacts,
  requestingPara,
  session,
}: {
  embedded?: boolean
  isVerified: boolean
  onApprovePolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onApplyPolicyChange: (requestId: string) => Promise<void>
  onRejectPolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onRequestParaGrant: () => Promise<void>
  onStartVerification: () => void
  proofArtifacts: ProofArtifact[]
  requestingPara: boolean
  session: IdentitySession
}) {
  const activeProofs = proofArtifacts.filter((proof) => proof.status === 'Active')

  return (
    <View style={consoleStyles.stack}>
      {embedded ? (
        <View style={consoleStyles.listBlock}>
          <SectionHeading
            title="PARA"
            detail="Proof use, connected apps, and community governance for this wallet."
          />
        </View>
      ) : (
        <SectionHero
          eyebrow="PARA"
          title={isVerified ? 'Selected card can request PARA proofs.' : 'Verification unlocks PARA use.'}
          body={`${session.paraProvider.detail} Durable community changes require approval from all 3 admins.`}
          icon="globe"
        />
      )}

      {!isVerified ? (
        <Pressable onPress={onStartVerification} style={[buttonStyle('primary'), consoleStyles.fullButton]}>
          <Text style={buttonTextStyle('primary')}>Verify before using PARA</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void onRequestParaGrant()}
          disabled={requestingPara}
          style={[buttonStyle('primary'), consoleStyles.fullButton, requestingPara && consoleStyles.disabled]}
        >
          {requestingPara ? (
            <ActivityIndicator color={tokens.onAccent} />
          ) : (
            <Text style={buttonTextStyle('primary')}>Start a PARA proof request</Text>
          )}
        </Pressable>
      )}

      <View style={consoleStyles.metricRow}>
        <Metric label="Provider" value={session.paraProvider.availability} />
        <Metric label="Policy" value={session.paraProvider.policyRecord} />
        <Metric label="Sync" value={session.paraProvider.lastSync} />
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Proof receipts" detail="These are the receipts PARA-compatible apps can consume." />
        {activeProofs.length > 0 ? (
          activeProofs.map((proof) => <ProofCard key={proof.id} proof={proof} />)
        ) : (
          <EmptyCard icon="shield" title="No active proof receipts yet" body="Approve a request to create proof-only receipts for PARA and other apps." />
        )}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="PARA claims" detail="Supported proofs for the selected card, backed by the private root." />
        {session.paraProvider.supportedClaims.map((claim) => (
          <SimpleRow
            key={claim}
            icon="check"
            title={CLAIM_LABELS[claim] ?? claim}
            detail="Available as proof-only output"
            meta="PARA"
          />
        ))}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Community Governance" detail="Durable PARA updates need unanimous approval from the 3 community admins." />
        {(session.policyChangeRequests ?? []).map((request) => (
          <PolicyChangeCard
            key={request.id}
            admins={session.communityAdmins ?? []}
            onApprovePolicyChange={onApprovePolicyChange}
            onApplyPolicyChange={onApplyPolicyChange}
            onRejectPolicyChange={onRejectPolicyChange}
            request={request}
          />
        ))}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Connected apps" detail="Apps that know how to ask iM8 for bounded proofs." />
        {session.integrations.map((integration) => (
          <SimpleRow
            key={integration.id}
            icon="globe"
            title={integration.name}
            detail={integration.summary}
            meta={integration.status}
          />
        ))}
      </View>
    </View>
  )
}

function PolicyChangeCard({
  admins,
  onApprovePolicyChange,
  onApplyPolicyChange,
  onRejectPolicyChange,
  request,
}: {
  admins: CommunityAdmin[]
  onApprovePolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onApplyPolicyChange: (requestId: string) => Promise<void>
  onRejectPolicyChange: (requestId: string, adminDid: string) => Promise<void>
  request: PolicyChangeRequest
}) {
  const approvedCount = request.approvals.filter((approval) => approval.status === 'approved').length
  const requiredCount = admins.length || 3
  const allApproved = approvedCount === requiredCount && request.approvals.every((approval) => approval.status === 'approved')
  const blocked = request.status === 'blocked'
  const applied = request.status === 'applied'
  const statusTone = applied || request.status === 'approved'
    ? 'success'
    : blocked
      ? 'danger'
      : 'warning'

  return (
    <View style={consoleStyles.receiptCard}>
      <View style={consoleStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={consoleStyles.cardTitle}>{request.title}</Text>
          <Text style={consoleStyles.cardBodyText}>{request.summary}</Text>
        </View>
        <StatusPill label={request.status.replace('_', ' ')} tone={statusTone} />
      </View>

      <SimpleFact label="Policy record" value={request.policyRecord} />
      <SimpleFact label="Proposed by" value={request.proposedBy} />
      <SimpleFact label="Admin approvals" value={`${approvedCount}/${requiredCount}`} />

      <View style={styles.adminList}>
        {admins.map((admin) => {
          const approval = request.approvals.find((item) => item.adminDid === admin.did)
          return (
            <AdminApprovalRow
              key={admin.did}
              admin={admin}
              approval={approval}
              disabled={blocked || applied}
              onApprove={() => void onApprovePolicyChange(request.id, admin.did)}
              onReject={() => void onRejectPolicyChange(request.id, admin.did)}
            />
          )
        })}
      </View>

      <Pressable
        onPress={() => void onApplyPolicyChange(request.id)}
        disabled={!allApproved || blocked || applied}
        style={[
          buttonStyle('primary'),
          consoleStyles.fullButton,
          (!allApproved || blocked || applied) && consoleStyles.disabled,
        ]}
      >
        <Text style={buttonTextStyle('primary')}>
          {applied ? 'Policy update applied' : allApproved ? 'Apply policy update' : 'Waiting for 3 admin approvals'}
        </Text>
      </Pressable>
    </View>
  )
}

function AdminApprovalRow({
  admin,
  approval,
  disabled,
  onApprove,
  onReject,
}: {
  admin: CommunityAdmin
  approval: AdminApproval | undefined
  disabled: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const status = approval?.status ?? 'pending'
  const tone = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'

  return (
    <View style={styles.adminRow}>
      <View style={{ flex: 1 }}>
        <Text style={consoleStyles.rowTitle}>{admin.displayName}</Text>
        <Text style={consoleStyles.rowDetail}>{admin.did}</Text>
      </View>
      <View style={styles.adminActions}>
        <StatusPill label={status} tone={tone} />
        {status === 'pending' ? (
          <View style={styles.adminButtonRow}>
            <Pressable onPress={onApprove} disabled={disabled} style={[styles.adminButton, disabled && consoleStyles.disabled]}>
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
            <Pressable onPress={onReject} disabled={disabled} style={[styles.adminButton, disabled && consoleStyles.disabled]}>
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function ProofCard({ proof }: { proof: ProofArtifact }) {
  return (
    <View style={consoleStyles.receiptCard}>
      <View style={consoleStyles.rowBetween}>
        <Text style={consoleStyles.cardTitle}>{CLAIM_LABELS[proof.claimType] ?? proof.label}</Text>
        <StatusPill label={proof.status} tone={proof.status === 'Active' ? 'success' : 'neutral'} />
      </View>
      <Text style={consoleStyles.cardBodyText}>{proof.summary}</Text>
      <SimpleFact label="Issuer" value={proof.issuer} />
      <SimpleFact label="Audience" value={proof.audienceAppId} />
      <SimpleFact label="Expires" value={proof.expiresAt} />
    </View>
  )
}

const styles = StyleSheet.create({
  adminList: {
    gap: 8,
    marginTop: 4,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: tokens.surfaceTransparent,
  },
  adminActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  adminButtonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  adminButton: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
  },
  approveText: {
    color: tokens.success,
    fontSize: 11,
    fontWeight: '800',
  },
  rejectText: {
    color: tokens.danger,
    fontSize: 11,
    fontWeight: '800',
  },
})
