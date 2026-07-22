import { Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  consoleStyles,
  SectionHeading,
  SimpleFact,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { tokens } from '../../../theme'
import type { AdminApproval, CommunityAdmin, IdentitySession, PolicyChangeRequest } from '../../../types'

export function GovernanceSection({
  onApprovePolicyChange,
  onApplyPolicyChange,
  onRejectPolicyChange,
  session,
}: {
  onApprovePolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onApplyPolicyChange: (requestId: string) => Promise<void>
  onRejectPolicyChange: (requestId: string, adminDid: string) => Promise<void>
  session: IdentitySession
}) {
  return (
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
