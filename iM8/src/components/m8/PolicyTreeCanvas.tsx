import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native'
import { Icon } from './Icon'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { PolicyNode, PolicyEdge, PolicyNodeType } from '../../types'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

const NODE_COLORS: Record<PolicyNodeType, { fill: string; stroke: string; text: string }> = {
  claim:     { fill: '#3B82F6', stroke: '#2563EB', text: '#FFFFFF' },
  source:    { fill: '#10B981', stroke: '#059669', text: '#FFFFFF' },
  position:  { fill: '#8B5CF6', stroke: '#7C3AED', text: '#FFFFFF' },
  question:  { fill: '#F59E0B', stroke: '#D97706', text: '#1F2937' },
  note:      { fill: '#6B7280', stroke: '#4B5563', text: '#F3F4F6' },
}

const EDGE_COLORS: Record<string, string> = {
  supports:    '#10B981',
  contradicts: '#EF4444',
  questions:   '#F59E0B',
  inspired:    '#8B5CF6',
  sources:     '#3B82F6',
}

const NODE_W = 140
const NODE_H = 80
const NODE_R = 8

type Props = {
  nodes: PolicyNode[]
  edges: PolicyEdge[]
  onNodePress?: (node: PolicyNode) => void
  onNodeLongPress?: (node: PolicyNode) => void
  onCanvasPress?: (x: number, y: number) => void
  onNodeDragEnd?: (nodeId: string, x: number, y: number) => void
  onNodeEdit?: (nodeId: string, content: string) => void
  onEdgeCreate?: (from: string, to: string, label: PolicyEdge['label']) => void
  selectedNodeIds?: string[]
  readOnly?: boolean
}

export default function PolicyTreeCanvas({
  nodes,
  edges,
  onNodePress,
  onNodeLongPress,
  onCanvasPress,
  onNodeDragEnd,
  onNodeEdit,
  onEdgeCreate,
  selectedNodeIds = [],
  readOnly = false,
}: Props) {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const savedScale = useSharedValue(1)

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Edge drawing state
  const [edgeFrom, setEdgeFrom] = useState<string | null>(null)
  const [edgePreview, setEdgePreview] = useState<{x: number, y: number} | null>(null)
  const [edgeLabel, setEdgeLabel] = useState<PolicyEdge['label']>('supports')

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX
      translateY.value = savedTranslateY.value + e.translationY
    })

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.3, Math.min(3, savedScale.value * e.scale))
    })

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  const handleNodeTap = useCallback((node: PolicyNode) => {
    if (edgeFrom) {
      // Complete edge drawing
      if (edgeFrom !== node.id) {
        onEdgeCreate?.(edgeFrom, node.id, edgeLabel)
      }
      setEdgeFrom(null)
      setEdgePreview(null)
      return
    }
    onNodePress?.(node)
  }, [edgeFrom, edgeLabel, onEdgeCreate, onNodePress])

  const handleNodeDoubleTap = useCallback((node: PolicyNode) => {
    if (readOnly) return
    setEditingNodeId(node.id)
    setEditText(node.content)
  }, [readOnly])

  const handleEditSubmit = useCallback(() => {
    if (editingNodeId && editText.trim()) {
      onNodeEdit?.(editingNodeId, editText.trim())
    }
    setEditingNodeId(null)
    setEditText('')
  }, [editingNodeId, editText, onNodeEdit])

  const startEdgeDraw = useCallback((nodeId: string) => {
    setEdgeFrom(nodeId)
  }, [])

  const renderEdge = (edge: PolicyEdge, isPreview = false) => {
    const from = nodes.find((n) => n.id === edge.from)
    const to = nodes.find((n) => n.id === edge.to)
    if (!from || !to) return null

    const x1 = from.x + NODE_W / 2
    const y1 = from.y + NODE_H / 2
    const x2 = to.x + NODE_W / 2
    const y2 = to.y + NODE_H / 2

    const color = isPreview ? '#94A3B8' : (EDGE_COLORS[edge.label] || '#9CA3AF')

    return (
      <View key={isPreview ? 'preview' : edge.id} style={StyleSheet.absoluteFill} pointerEvents="none">
        <SvgLine x1={x1} y1={y1} x2={x2} y2={y2} color={color} isPreview={isPreview} />
        {!isPreview && <SvgArrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} />}
      </View>
    )
  }

  const renderNode = (node: PolicyNode) => {
    const colors = NODE_COLORS[node.type]
    const isSelected = selectedNodeIds.includes(node.id)
    const isEditing = editingNodeId === node.id
    const isEdgeSource = edgeFrom === node.id

    return (
      <View
        key={node.id}
        style={[
          styles.node,
          {
            left: node.x,
            top: node.y,
            backgroundColor: colors.fill,
            borderColor: isEdgeSource ? '#F59E0B' : (isSelected ? '#FFFFFF' : colors.stroke),
            borderWidth: isEdgeSource ? 4 : (isSelected ? 3 : 2),
            shadowOpacity: isSelected ? 0.4 : 0.15,
          },
        ]}
      >
        {isEditing ? (
          <TextInput
            style={[styles.editInput, { color: colors.text }]}
            value={editText}
            onChangeText={setEditText}
            onSubmitEditing={handleEditSubmit}
            onBlur={handleEditSubmit}
            autoFocus
            multiline
            maxLength={200}
            placeholder="Enter claim..."
            placeholderTextColor={colors.text + '80'}
          />
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleNodeTap(node)}
            onLongPress={() => onNodeLongPress?.(node)}
            delayLongPress={400}
            onPressIn={() => {
              // Start edge draw on long press start
              if (!readOnly && !edgeFrom) {
                const timer = setTimeout(() => startEdgeDraw(node.id), 600)
                ;(node as any)._edgeTimer = timer
              }
            }}
            onPressOut={() => {
              if ((node as any)._edgeTimer) {
                clearTimeout((node as any)._edgeTimer)
                ;(node as any)._edgeTimer = null
              }
            }}
          >
            <Text style={[styles.nodeType, { color: colors.text }]}>
              {node.type.toUpperCase()}
            </Text>
            <Text
              style={[styles.nodeContent, { color: colors.text }]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {node.content}
            </Text>
          </TouchableOpacity>
        )}
        {node.sourceRefs && node.sourceRefs.length > 0 && (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>
              {node.sourceRefs.length} src
            </Text>
          </View>
        )}
        {/* Double-tap hint */}
        {!isEditing && (
          <TouchableOpacity
            style={styles.editHint}
            onPress={() => handleNodeDoubleTap(node)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.editHintText}>✎</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={Gesture.Simultaneous(panGesture, pinchGesture)}>
        <Reanimated.View style={[StyleSheet.absoluteFill, canvasStyle]}>
          {/* Edges layer */}
          {edges.map((e) => renderEdge(e))}
          {/* Edge preview */}
          {edgeFrom && edgePreview && (
            renderEdge(
              { id: 'preview', from: edgeFrom, to: 'preview', label: edgeLabel },
              true
            )
          )}

          {/* Nodes layer */}
          {nodes.map(renderNode)}
        </Reanimated.View>
      </GestureDetector>

      {/* Edge label selector (when drawing) */}
      {edgeFrom && (
        <View style={styles.edgeLabelBar}>
          {(['supports', 'contradicts', 'questions', 'inspired', 'sources'] as const).map((label) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.edgeLabelChip,
                edgeLabel === label && styles.edgeLabelChipActive,
              ]}
              onPress={() => setEdgeLabel(label)}
            >
              <Text style={[
                styles.edgeLabelText,
                edgeLabel === label && styles.edgeLabelTextActive,
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.edgeCancel}
            onPress={() => { setEdgeFrom(null); setEdgePreview(null) }}
          >
            <Icon name="circleX" size={14} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => {
            scale.value = 1
            translateX.value = 0
            translateY.value = 0
          }}
        >
          <Text style={styles.toolText}>⌖</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => {
            scale.value = Math.min(scale.value * 1.2, 3)
          }}
        >
          <Text style={styles.toolText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => {
            scale.value = Math.max(scale.value / 1.2, 0.3)
          }}
        >
          <Text style={styles.toolText}>−</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  )
}

function SvgLine({ x1, y1, x2, y2, color, isPreview = false }: {
  x1: number; y1: number; x2: number; y2: number; color: string; isPreview?: boolean
}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  return (
    <View
      style={{
        position: 'absolute',
        left: x1,
        top: y1 + NODE_H / 2 - 1,
        width: length,
        height: isPreview ? 1 : 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: '0 0',
        opacity: isPreview ? 0.4 : 0.6,
      }}
    />
  )
}

function SvgArrow({ x1, y1, x2, y2, color }: {
  x1: number; y1: number; x2: number; y2: number; color: string
}) {
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI

  return (
    <View
      style={{
        position: 'absolute',
        left: x2 - 6,
        top: y2 + NODE_H / 2 - 6,
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        transform: [{ rotate: `${angle + 90}deg` }],
        opacity: 0.8,
      }}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  node: {
    position: 'absolute',
    width: NODE_W,
    height: NODE_H,
    borderRadius: NODE_R,
    padding: 10,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  editInput: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    minHeight: 40,
  },
  nodeType: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
    opacity: 0.9,
  },
  nodeContent: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  sourceBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sourceBadgeText: {
    color: '#F3F4F6',
    fontSize: 9,
    fontWeight: '700',
  },
  editHint: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editHintText: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.7,
  },
  edgeLabelBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    zIndex: 20,
  },
  edgeLabelChip: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  edgeLabelChipActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#3B82F6',
  },
  edgeLabelText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  edgeLabelTextActive: {
    color: '#93C5FD',
    fontWeight: '700',
  },
  edgeCancel: {
    marginLeft: 'auto',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#7F1D1D',
  },
  edgeCancelText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  toolbar: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
})
