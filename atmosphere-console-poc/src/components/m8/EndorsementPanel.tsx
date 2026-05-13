import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { KnowledgeBundle, PermissionedSpace } from '../../types'
import InfoTooltip from '../m8/InfoTooltip'

// ── Props ──
type Props = {
  visible: boolean
  bundles: KnowledgeBundle[]
  spaces: PermissionedSpace[]
  onEndorse: (bundleId: string) => void
  onChallenge: (bundleId: string, reason: string) => void
  onRequestRevision: (bundleId: string, feedback: string) => void
  onClose: () => void
  isModerator: boolean
}

export default function EndorsementPanel({
  visible,
  bundles,
  spaces,
  onEndorse,
  onChallenge,
  onRequestRevision,
  onClose,
  isModerator,
}: Props) {
  if (!visible) return null

  // Only show bundles under review or endorsed
  const activeBundles = bundles.filter(
    (b) => b.status === 'submitted' || b.status === 'under_review' || b.status === 'endorsed'
  )

  const getSpaceName = (did: string) =>
    spaces.find((s) => s.did === did)?.name || did.slice(0, 20) + '…'

  const getThresholdMeter = (bundle: KnowledgeBundle, space: PermissionedSpace) => {
    const count = bundle.endorsements.length
    const needed = Math.ceil(space.memberDids.length * space.endorsementThreshold)
    const pct = space.memberDids.length > 0 ? count / space.memberDids.length : 0
    return { count, needed, pct }
  }

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Moderation Queue</Text>
          <InfoTooltip
            title="Moderation Queue"
            explanation="Bundles submitted to permissioned spaces await moderator review. Endorsements require reaching the space's threshold (e.g. 67%). Endorsed bundles merge into the Trust Mesh. Rejected bundles disappear until resubmitted."
          />
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {!isModerator && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Moderator mode required. Request access from space owner.
            </Text>
          </View>
        )}

        {activeBundles.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bundles pending review.</Text>
          </View>
        )}

        {activeBundles.map((bundle) => {
          const space = spaces.find((s) => s.did === bundle.spaceUri)
          const { count, needed, pct } = space
            ? getThresholdMeter(bundle, space)
            : { count: 0, needed: 0, pct: 0 }

          return (
            <View key={bundle.id} style={styles.bundleCard}>
              {/* Bundle header */}
              <View style={styles.bundleHeader}>
                <Text style={styles.bundleName}>{bundle.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    bundle.status === 'endorsed' && styles.statusEndorsed,
                    bundle.status === 'under_review' && styles.statusReview,
                    bundle.status === 'submitted' && styles.statusSubmitted,
                  ]}
                >
                  <Text style={styles.statusText}>{bundle.status.replace('_', ' ')}</Text>
                </View>
              </View>

              {/* Meta */}
              <Text style={styles.bundleMeta}>
                {bundle.nodeIds.length} nodes · {getSpaceName(bundle.spaceUri)} · by{' '}
                {bundle.authorDid.slice(0, 16)}…
              </Text>

              {/* Threshold meter */}
              {space && (
                <View style={styles.meter}>
                  <View style={styles.meterTrack}>
                    <View
                      style={[
                        styles.meterFill,
                        {
                          width: `${Math.min(pct * 100, 100)}%`,
                          backgroundColor:
                            pct >= space.endorsementThreshold ? '#10B981' : '#F59E0B',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.meterLabel}>
                    {count} of {needed} endorsements needed
                  </Text>
                </View>
              )}

              {/* Proofs attached */}
              {bundle.attachedProofs.length > 0 && (
                <View style={styles.proofsRow}>
                  {bundle.attachedProofs.map((proof, i) => (
                    <View key={i} style={styles.proofBadge}>
                      <Text style={styles.proofBadgeText}>{proof.slice(0, 8)}…</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Challenges */}
              {bundle.challenges.length > 0 && (
                <View style={styles.challenges}>
                  {bundle.challenges.map((c, i) => (
                    <Text key={i} style={styles.challengeText}>
                      ⚠️ {c.reason} — {c.did.slice(0, 12)}…
                    </Text>
                  ))}
                </View>
              )}

              {/* Actions */}
              {isModerator && bundle.status !== 'endorsed' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.endorseButton]}
                    onPress={() => onEndorse(bundle.id)}
                  >
                    <Text style={styles.actionText}>Endorse</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.challengeButton]}
                    onPress={() => onChallenge(bundle.id, 'Factual dispute')}
                  >
                    <Text style={styles.actionText}>Challenge</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.revisionButton]}
                    onPress={() =>
                      onRequestRevision(bundle.id, 'Needs more sources')
                    }
                  >
                    <Text style={styles.actionText}>Request revision</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 320,
    backgroundColor: '#0F172A',
    borderLeftWidth: 1,
    borderLeftColor: '#1E293B',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  close: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  notice: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  noticeText: {
    color: '#93C5FD',
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  bundleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bundleName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusEndorsed: {
    backgroundColor: '#064E3B',
  },
  statusReview: {
    backgroundColor: '#78350F',
  },
  statusSubmitted: {
    backgroundColor: '#1E3A5F',
  },
  statusText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bundleMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 10,
  },
  meter: {
    marginBottom: 10,
  },
  meterTrack: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  meterLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  proofsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  proofBadge: {
    backgroundColor: '#0B1120',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proofBadgeText: {
    color: '#64748B',
    fontSize: 9,
  },
  challenges: {
    marginBottom: 10,
  },
  challengeText: {
    color: '#FCA5A5',
    fontSize: 11,
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  endorseButton: {
    backgroundColor: '#059669',
  },
  challengeButton: {
    backgroundColor: '#DC2626',
  },
  revisionButton: {
    backgroundColor: '#4B5563',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
})
