import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { PolicyNode, PolicyEdge, KnowledgeBundle } from '../../types'

// ── Type colors (same as canvas) ──
const NODE_COLORS: Record<string, string> = {
  claim: '#3B82F6',
  source: '#10B981',
  position: '#8B5CF6',
  question: '#F59E0B',
  note: '#6B7280',
}

const EDGE_LABELS: Record<string, string> = {
  supports: 'supports',
  contradicts: 'contradicts',
  questions: 'questions',
  inspired: 'inspired by',
  sources: 'sources',
}

// ── Props ──
type Props = {
  nodes: PolicyNode[]
  edges: PolicyEdge[]
  bundles: KnowledgeBundle[]
  onNodePress?: (node: PolicyNode) => void
  onBundlePress?: (bundle: KnowledgeBundle) => void
}

export default function PolicyList({
  nodes,
  edges,
  bundles,
  onNodePress,
  onBundlePress,
}: Props) {
  // Group nodes by type
  const nodesByType = React.useMemo(() => {
    const groups: Record<string, PolicyNode[]> = {}
    for (const node of nodes) {
      if (!groups[node.type]) groups[node.type] = []
      groups[node.type].push(node)
    }
    return groups
  }, [nodes])

  // Count edges per node
  const edgeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const edge of edges) {
      counts[edge.from] = (counts[edge.from] || 0) + 1
      counts[edge.to] = (counts[edge.to] || 0) + 1
    }
    return counts
  }, [edges])

  // Find connected nodes for each node
  const getConnections = (nodeId: string) => {
    const connected = edges
      .filter((e) => e.from === nodeId || e.to === nodeId)
      .map((e) => {
        const otherId = e.from === nodeId ? e.to : e.from
        const other = nodes.find((n) => n.id === otherId)
        return other ? `${EDGE_LABELS[e.label]} ${other.content.slice(0, 20)}…` : null
      })
      .filter(Boolean)
    return connected.slice(0, 2)
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Bundles section */}
      {bundles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared Bundles</Text>
          {bundles.map((bundle) => (
            <TouchableOpacity
              key={bundle.id}
              style={styles.bundleCard}
              onPress={() => onBundlePress?.(bundle)}
            >
              <View style={styles.bundleHeader}>
                <Text style={styles.bundleName}>{bundle.name}</Text>
                <View
                  style={[
                    styles.bundleStatus,
                    bundle.status === 'endorsed' && styles.statusEndorsed,
                    bundle.status === 'rejected' && styles.statusRejected,
                    bundle.status === 'under_review' && styles.statusReview,
                  ]}
                >
                  <Text style={styles.bundleStatusText}>
                    {bundle.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.bundleMeta}>
                {bundle.nodeIds.length} nodes · {bundle.edgeIds.length} edges ·{' '}
                {bundle.endorsements.length} endorsements
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Nodes by type */}
      {Object.entries(nodesByType).map(([type, typeNodes]) => (
        <View key={type} style={styles.section}>
          <View style={styles.typeHeader}>
            <View
              style={[styles.typeDot, { backgroundColor: NODE_COLORS[type] }]}
            />
            <Text style={styles.sectionTitle}>
              {type.charAt(0).toUpperCase() + type.slice(1)}s
            </Text>
            <Text style={styles.typeCount}>{typeNodes.length}</Text>
          </View>

          {typeNodes.map((node) => {
            const connections = getConnections(node.id)
            const edgeCount = edgeCounts[node.id] || 0

            return (
              <TouchableOpacity
                key={node.id}
                style={styles.nodeCard}
                onPress={() => onNodePress?.(node)}
              >
                <View style={styles.nodeHeader}>
                  <Text style={styles.nodeContent} numberOfLines={2}>
                    {node.content}
                  </Text>
                  {node.spaceUri && (
                    <View style={styles.sharedBadge}>
                      <Text style={styles.sharedBadgeText}>shared</Text>
                    </View>
                  )}
                </View>

                {connections.length > 0 && (
                  <View style={styles.connections}>
                    {connections.map((c, i) => (
                      <Text key={i} style={styles.connectionText}>
                        → {c}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.nodeFooter}>
                  <Text style={styles.nodeMeta}>
                    {edgeCount} connection{edgeCount !== 1 ? 's' : ''}
                  </Text>
                  {node.sourceRefs && node.sourceRefs.length > 0 && (
                    <Text style={styles.nodeMeta}>
                      {node.sourceRefs.length} source
                      {node.sourceRefs.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      ))}

      {nodes.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No nodes yet.</Text>
          <Text style={styles.emptySub}>
            Create your first claim or note to start building your knowledge graph.
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  typeCount: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  bundleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
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
  bundleStatus: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#334155',
  },
  statusEndorsed: {
    backgroundColor: '#064E3B',
  },
  statusRejected: {
    backgroundColor: '#7F1D1D',
  },
  statusReview: {
    backgroundColor: '#78350F',
  },
  bundleStatusText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bundleMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  nodeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#334155',
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nodeContent: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  sharedBadge: {
    backgroundColor: '#1E3A5F',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sharedBadgeText: {
    color: '#93C5FD',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  connections: {
    marginTop: 8,
  },
  connectionText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  nodeFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  nodeMeta: {
    color: '#64748B',
    fontSize: 11,
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
})
