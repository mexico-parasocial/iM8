import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useAIAssist, AI_TASK_LABELS, AI_TASK_ICONS, type AITaskType } from './aiPrompts'
import { PolicyNode } from '../../types'

// ── Props ──
type Props = {
  visible: boolean
  selectedNodes: PolicyNode[]
  onClose: () => void
  onAcceptDraft: (draft: { type: string; content: string; reason: string }) => void
  onDismissAll: () => void
}

export default function AIAssistPanel({
  visible,
  selectedNodes,
  onClose,
  onAcceptDraft,
  onDismissAll,
}: Props) {
  const { state, result, error, callAI, reset } = useAIAssist()

  if (!visible) return null

  const hasSelection = selectedNodes.length > 0
  const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null
  const canContext = singleNode != null
  const canCounter = singleNode != null
  const canStructure = selectedNodes.length >= 2
  const canSources = singleNode != null

  const handleTask = async (task: AITaskType) => {
    if (!hasSelection) return

    const payload =
      task === 'structure'
        ? {
            claims: selectedNodes.map((n) => ({
              id: n.id,
              content: n.content,
              type: n.type,
            })),
            edges: [],
          }
        : { claimContent: singleNode?.content || '' }

    await callAI(task, payload)
  }

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💡 AI Assist</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Task buttons */}
        {!result && (
          <View style={styles.taskGrid}>
            <TaskButton
              icon={AI_TASK_ICONS.context}
              label={AI_TASK_LABELS.context}
              enabled={canContext}
              onPress={() => handleTask('context')}
            />
            <TaskButton
              icon={AI_TASK_ICONS.counter}
              label={AI_TASK_LABELS.counter}
              enabled={canCounter}
              onPress={() => handleTask('counter')}
            />
            <TaskButton
              icon={AI_TASK_ICONS.structure}
              label={AI_TASK_LABELS.structure}
              enabled={canStructure}
              onPress={() => handleTask('structure')}
            />
            <TaskButton
              icon={AI_TASK_ICONS.sources}
              label={AI_TASK_LABELS.sources}
              enabled={canSources}
              onPress={() => handleTask('sources')}
            />
          </View>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Thinking…</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={reset}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {result && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {AI_TASK_ICONS[result.task]} {AI_TASK_LABELS[result.task]}
            </Text>

            {result.draftNodes.length === 0 && (
              <Text style={styles.noDrafts}>No suggestions generated.</Text>
            )}

            {result.draftNodes.map((draft, i) => (
              <View key={i} style={styles.draftCard}>
                <View style={styles.draftHeader}>
                  <View style={[styles.draftTypeDot, { backgroundColor: typeColor(draft.type) }]} />
                  <Text style={styles.draftType}>{draft.type}</Text>
                  <Text style={styles.draftReason}>{draft.reason}</Text>
                </View>
                <Text style={styles.draftContent}>{draft.content}</Text>
                <View style={styles.draftActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => {
                      onAcceptDraft(draft)
                      // Remove from result
                      result.draftNodes.splice(i, 1)
                      if (result.draftNodes.length === 0) reset()
                    }}
                  >
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => {
                      result.draftNodes.splice(i, 1)
                      if (result.draftNodes.length === 0) reset()
                    }}
                  >
                    <Text style={styles.dismissText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.dismissAll} onPress={onDismissAll}>
              <Text style={styles.dismissAllText}>Dismiss all</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── Task button ──
function TaskButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: string
  label: string
  enabled: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.taskButton, !enabled && styles.taskButtonDisabled]}
      onPress={onPress}
      disabled={!enabled}
    >
      <Text style={styles.taskIcon}>{icon}</Text>
      <Text style={[styles.taskLabel, !enabled && styles.taskLabelDisabled]}>{label}</Text>
    </TouchableOpacity>
  )
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    claim: '#3B82F6',
    source: '#10B981',
    position: '#8B5CF6',
    question: '#F59E0B',
    note: '#6B7280',
  }
  return colors[type] || '#6B7280'
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 300,
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
  taskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  taskButton: {
    width: '47%',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  taskButtonDisabled: {
    opacity: 0.4,
  },
  taskIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  taskLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  taskLabelDisabled: {
    color: '#64748B',
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  retryText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  results: {
    marginTop: 8,
  },
  resultsTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  noDrafts: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  draftCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  draftTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  draftType: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  draftReason: {
    color: '#64748B',
    fontSize: 10,
    marginLeft: 'auto',
  },
  draftContent: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  draftActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissAll: {
    marginTop: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  dismissAllText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
})
