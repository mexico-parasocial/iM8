import { useState } from 'react'
import { View, Pressable, Text, StyleSheet, ScrollView } from 'react-native'
import PolicyTreeCanvas from '../../../components/m8/PolicyTreeCanvas'
import PolicyList from '../../../components/m8/PolicyList'
import SpaceShareModal from '../../../components/m8/SpaceShareModal'
import EndorsementPanel from '../../../components/m8/EndorsementPanel'
import AIAssistPanel from '../../../components/m8/AIAssistPanel'
import MyBaseSettingsModal from '../../../components/m8/MyBaseSettingsModal'
import { Icon } from '../../../components/m8/Icon'
import type { PolicyNode, PolicyEdge, KnowledgeBundle, PermissionedSpace, ProofArtifact } from '../../../types'
import { tokens } from '../../../theme'

export function MyBaseSection({
  sessionDid,
  proofArtifacts,
  theme,
  addNotification,
}: {
  sessionDid: string
  proofArtifacts: ProofArtifact[]
  theme: typeof tokens
  addNotification: (icon: string, title: string) => void
}) {
  const [policyNodes, setPolicyNodes] = useState<PolicyNode[]>([])
  const [policyEdges, setPolicyEdges] = useState<PolicyEdge[]>([])
  const [knowledgeBundles, setKnowledgeBundles] = useState<KnowledgeBundle[]>([])
  const [permissionedSpaces] = useState<PermissionedSpace[]>([])
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [canvasView, setCanvasView] = useState<'canvas' | 'list'>('list')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareBundle, setShareBundle] = useState<KnowledgeBundle | null>(null)
  const [showEndorsementPanel, setShowEndorsementPanel] = useState(false)
  const [isModerator, setIsModerator] = useState(false)
  const [showMyBaseSettings, setShowMyBaseSettings] = useState(false)
  const [showAIAssist, setShowAIAssist] = useState(false)
  const [showSecondaryTools, setShowSecondaryTools] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      {/* Primary Toolbar */}
      <View style={styles.primaryToolbar}>
        <View style={styles.toolbarGroup}>
          <Pressable
            onPress={() => setCanvasView(canvasView === 'canvas' ? 'list' : 'canvas')}
            style={styles.toolbarButton}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={canvasView === 'canvas' ? 'list' : 'grid'} size={12} color={tokens.text} />
              <Text style={styles.toolbarButtonText}>
                {canvasView === 'canvas' ? 'List' : 'Canvas'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              const newNode: PolicyNode = {
                id: `node-${Date.now()}`,
                type: 'claim',
                content: 'New claim',
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 200,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
              setPolicyNodes((prev) => [...prev, newNode])
            }}
            style={[styles.toolbarButton, styles.toolbarButtonPrimary]}
          >
            <Text style={[styles.toolbarButtonText, styles.toolbarButtonPrimaryText]}>+ Claim</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (selectedNodeIds.length > 0) {
                const bundle: KnowledgeBundle = {
                  id: `bundle-${Date.now()}`,
                  name: `Bundle ${knowledgeBundles.length + 1}`,
                  nodeIds: [...selectedNodeIds],
                  edgeIds: policyEdges
                    .filter((e) => selectedNodeIds.includes(e.from) && selectedNodeIds.includes(e.to))
                    .map((e) => e.id),
                  spaceUri: '',
                  authorDid: sessionDid,
                  attachedProofs: [],
                  status: 'draft',
                  endorsements: [],
                  challenges: [],
                }
                setShareBundle(bundle)
                setShowShareModal(true)
              }
            }}
            style={[
              styles.toolbarButton,
              styles.toolbarButtonPrimary,
              selectedNodeIds.length === 0 && styles.toolbarButtonDisabled,
            ]}
          >
            <Text style={[styles.toolbarButtonText, styles.toolbarButtonPrimaryText]}>Share</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowSecondaryTools(!showSecondaryTools)}
            style={[styles.toolbarButton, showSecondaryTools && styles.toolbarButtonActive]}
          >
            <Text style={styles.toolbarButtonText}>⋯</Text>
          </Pressable>
        </View>
      </View>

      {/* Secondary Toolbar (collapsible) */}
      {showSecondaryTools && (
        <View style={styles.secondaryToolbar}>
          <Pressable
            onPress={() => setShowAIAssist(!showAIAssist)}
            style={[styles.toolbarButton, showAIAssist && styles.toolbarButtonActive]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="zap" size={12} color={tokens.text} />
              <Text style={styles.toolbarButtonText}>AI Assist</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setShowMyBaseSettings(true)}
            style={styles.toolbarButton}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="settingsGear" size={12} color={tokens.text} />
              <Text style={styles.toolbarButtonText}>Settings</Text>
            </View>
          </Pressable>

          {isModerator && (
            <Pressable
              onPress={() => setShowEndorsementPanel(!showEndorsementPanel)}
              style={[styles.toolbarButton, showEndorsementPanel && styles.toolbarButtonActive]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="shield" size={12} color={tokens.text} />
                <Text style={styles.toolbarButtonText}>Moderator</Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* Edge draw hint */}
      {policyNodes.length > 0 && policyEdges.length === 0 && (
        <View style={styles.hintBar}>
          <Text style={styles.hintText}>Long-press a node, then tap another to connect</Text>
        </View>
      )}

      {/* Canvas or List */}
      {canvasView === 'canvas' ? (
        <PolicyTreeCanvas
          nodes={policyNodes}
          edges={policyEdges}
          selectedNodeIds={selectedNodeIds}
          onNodePress={(node) => {
            setSelectedNodeIds((prev) =>
              prev.includes(node.id)
                ? prev.filter((id) => id !== node.id)
                : [...prev, node.id]
            )
          }}
          onNodeDragEnd={(nodeId, x, y) => {
            setPolicyNodes((prev) =>
              prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
            )
          }}
          onNodeEdit={(nodeId, content) => {
            setPolicyNodes((prev) =>
              prev.map((n) => (n.id === nodeId ? { ...n, content } : n))
            )
          }}
          onEdgeCreate={(from, to, label) => {
            const newEdge: PolicyEdge = {
              id: `edge-${Date.now()}`,
              from,
              to,
              label,
            }
            setPolicyEdges((prev) => [...prev, newEdge])
            setSelectedNodeIds([])
            addNotification('arrowRight', `Linked nodes with ${label}`)
          }}
        />
      ) : (
        <PolicyList
          nodes={policyNodes}
          edges={policyEdges}
          bundles={knowledgeBundles}
          onNodePress={(node) => {
            setSelectedNodeIds((prev) =>
              prev.includes(node.id)
                ? prev.filter((id) => id !== node.id)
                : [...prev, node.id]
            )
          }}
        />
      )}

      {/* Modals & Panels */}
      <SpaceShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        bundle={shareBundle}
        availableProofs={proofArtifacts}
        onSubmit={(bundleId, spaceDid, attachedProofs) => {
          setKnowledgeBundles((prev) =>
            prev.map((b) =>
              b.id === bundleId
                ? { ...b, status: 'submitted', spaceUri: spaceDid, attachedProofs }
                : b
            )
          )
          setShowShareModal(false)
          addNotification('paperPlane', `Bundle submitted to space`)
        }}
      />

      <EndorsementPanel
        visible={showEndorsementPanel}
        bundles={knowledgeBundles}
        spaces={permissionedSpaces}
        onEndorse={(bundleId) => {
          setKnowledgeBundles((prev) =>
            prev.map((b) =>
              b.id === bundleId
                ? {
                    ...b,
                    status: 'endorsed',
                    endorsements: [
                      ...b.endorsements,
                      { did: sessionDid, timestamp: new Date().toISOString() },
                    ],
                  }
                : b
            )
          )
        }}
        onChallenge={(bundleId, reason) => {
          setKnowledgeBundles((prev) =>
            prev.map((b) =>
              b.id === bundleId
                ? {
                    ...b,
                    challenges: [
                      ...b.challenges,
                      { did: sessionDid, reason, timestamp: new Date().toISOString() },
                    ],
                  }
                : b
            )
          )
        }}
        onRequestRevision={() => {}}
        onClose={() => setShowEndorsementPanel(false)}
        isModerator={isModerator}
      />

      <AIAssistPanel
        visible={showAIAssist}
        selectedNodes={policyNodes.filter((n) => selectedNodeIds.includes(n.id))}
        onClose={() => setShowAIAssist(false)}
        onAcceptDraft={(draft) => {
          const newNode = {
            id: `ai-${Date.now()}`,
            type: draft.type as any,
            content: draft.content,
            x: 150 + Math.random() * 100,
            y: 150 + Math.random() * 100,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          setPolicyNodes((prev) => [...prev, newNode])
          addNotification('zap', `Added AI ${draft.type}: ${draft.content.slice(0, 30)}...`)
        }}
        onDismissAll={() => setShowAIAssist(false)}
      />

      <MyBaseSettingsModal
        visible={showMyBaseSettings}
        onClose={() => setShowMyBaseSettings(false)}
        isModerator={isModerator}
        onToggleModerator={setIsModerator}
        darkMode={false}
        onToggleDarkMode={() => {}}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  primaryToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.glassBorder,
  },
  secondaryToolbar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surfaceRaised,
    borderBottomWidth: 1,
    borderBottomColor: tokens.glassBorder,
  },
  toolbarGroup: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flex: 1,
  },
  toolbarButton: {
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
    alignItems: 'center',
    flex: 1,
  },
  toolbarButtonDisabled: {
    opacity: 0.4,
  },
  toolbarButtonActive: {
    backgroundColor: tokens.accent + '30',
    borderColor: tokens.accent,
  },
  toolbarButtonPrimary: {
    backgroundColor: tokens.accent,
    borderColor: tokens.accent,
  },
  toolbarButtonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toolbarButtonText: {
    color: tokens.text,
    fontSize: 12,
    fontWeight: '600',
  },
  hintBar: {
    backgroundColor: tokens.accent + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.glassBorder,
  },
  hintText: {
    color: tokens.accent,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
})
