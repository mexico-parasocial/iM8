import { Pressable, StyleSheet, Text, View } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { MiniStat, CoreRow, EmptyState } from '../../../components/m8/ConsolePrimitives'
import type { ClaimRequest, AppGrant, ProofArtifact } from '../../../types'
import { tokens } from '../../../theme'

export function GrantsSection({
  visibleRequests,
  visibleGrants,
  selectedRequest,
  selectedGrant,
  selectedArtifacts,
  onSelectRequest,
  onSelectGrant,
  onApprove,
  onRevoke,
  theme,
}: {
  visibleRequests: ClaimRequest[]
  visibleGrants: AppGrant[]
  selectedRequest: ClaimRequest | null
  selectedGrant: AppGrant | null
  selectedArtifacts: ProofArtifact[]
  onSelectRequest: (id: string) => void
  onSelectGrant: (id: string) => void
  onApprove: (id: string) => Promise<void>
  onRevoke: (id: string) => Promise<void>
  theme: typeof tokens
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Pending requests</Text>
        {visibleRequests.length > 0 ? (
          visibleRequests.map((request) => (
            <Pressable
              key={request.id}
              onPress={() => onSelectRequest(request.id)}
              style={rowStyle(selectedRequest?.id === request.id ? 'active' : 'default')}
            >
              <View style={rowStyles.text}>
                <Text style={rowStyles.title}>{request.appName}</Text>
                <Text style={rowStyles.detail}>{request.appKind} · {request.audience}</Text>
              </View>
              <View style={pillStyle('warning')}>
                <Text style={pillTextStyle('warning')}>{request.status}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyState icon="check" title="All caught up" detail="No apps waiting for your approval." />
        )}
      </View>

      {selectedRequest && (
        <View style={cardStyle('filled')}>
          <Text style={styles.summaryEyebrow}>Request detail</Text>
          <Text style={styles.summaryTitle}>{selectedRequest.appName}</Text>
          <Text style={styles.summaryBody}>{selectedRequest.reason}</Text>
          <View style={styles.coreList}>
            <CoreRow label="Surface" value={selectedRequest.surface} />
            <CoreRow label="Audience" value={selectedRequest.audience} />
            <CoreRow label="Expiry" value={selectedRequest.expiryPreference} />
          </View>
          <View style={styles.detailActions}>
            <Pressable onPress={() => void onApprove(selectedRequest.id)} style={buttonStyle('primary')}>
              <Text style={buttonTextStyle('primary')}>Approve</Text>
            </Pressable>
            <Pressable style={buttonStyle('danger')}>
              <Text style={buttonTextStyle('danger')}>Deny</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Active proofs</Text>
        {visibleGrants.length > 0 ? (
          visibleGrants.map((grant) => (
            <Pressable
              key={grant.id}
              onPress={() => onSelectGrant(grant.id)}
              style={rowStyle(selectedGrant?.id === grant.id ? 'active' : 'default')}
            >
              <View style={rowStyles.text}>
                <Text style={rowStyles.title}>{grant.appName}</Text>
                <Text style={rowStyles.detail}>{grant.audience}</Text>
              </View>
              <View style={pillStyle(grant.status === 'Active' ? 'success' : 'muted')}>
                <Text style={pillTextStyle(grant.status === 'Active' ? 'success' : 'muted')}>
                  {grant.status}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyState icon="lock" title="No active proofs" detail="Approve a request to start sharing claims." />
        )}
      </View>

      {selectedGrant && (
        <View style={cardStyle('filled')}>
          <Text style={styles.summaryEyebrow}>Grant detail</Text>
          <Text style={styles.summaryTitle}>{selectedGrant.appName}</Text>
          <Text style={styles.summaryBody}>{selectedGrant.reason}</Text>
          <View style={styles.coreList}>
            <CoreRow label="Surface" value={selectedGrant.surface} />
            <CoreRow label="Granted" value={selectedGrant.grantedAt} />
            <CoreRow label="Last used" value={selectedGrant.lastUsed} />
          </View>
          {selectedGrant.status === 'Active' && (
            <View style={styles.detailActions}>
              <Pressable onPress={() => void onRevoke(selectedGrant.id)} style={buttonStyle('danger')}>
                <Text style={buttonTextStyle('danger')}>Revoke access</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {selectedArtifacts.length > 0 && (
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Linked artifacts</Text>
          {selectedArtifacts.map((artifact) => (
            <MiniStat key={artifact.id} label={claimLabel(artifact.claimType)} value={`${artifact.summary} · Expires: ${artifact.expiresAt}`} />
          ))}
        </View>
      )}
    </View>
  )
}

function claimLabel(claim: string) {
  const labels: Record<string, string> = {
    is_verified_public_figure: 'Verified public figure',
    is_civic_eligible: 'Civic eligible',
    has_para_verification: 'PARA verified',
    has_party_affiliation_match: 'Party match',
    is_age_eligible: 'Age eligible',
    has_backup_coverage: 'Backup',
  }
  return labels[claim] ?? claim
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
  coreList: {
    gap: 8,
    marginTop: 12,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
})
