import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native'
import { KnowledgeBundle, PermissionedSpace, ProofArtifact } from '../../types'
import InfoTooltip from '../m8/InfoTooltip'

// ── Mock permissioned spaces ──
const MOCK_SPACES: PermissionedSpace[] = [
  {
    did: 'did:web:para.civic.mx',
    type: 'com.para.space.civic',
    name: 'Civic Discourse',
    ownerDid: 'did:plc:abc123',
    memberDids: [],
    requiredProofs: ['is_civic_eligible'],
    endorsementThreshold: 0.67,
  },
  {
    did: 'did:web:para.regional.chihuahua',
    type: 'com.para.space.regional',
    name: 'Chihuahua Local',
    ownerDid: 'did:plc:def456',
    memberDids: [],
    requiredProofs: ['is_civic_eligible'],
    endorsementThreshold: 0.51,
  },
  {
    did: 'did:web:para.topic.energy',
    type: 'com.para.space.topic',
    name: 'Energy Policy',
    ownerDid: 'did:plc:ghi789',
    memberDids: [],
    requiredProofs: [],
    endorsementThreshold: 0.51,
  },
]

// ── Props ──
type Props = {
  visible: boolean
  onClose: () => void
  bundle: KnowledgeBundle | null
  availableProofs: ProofArtifact[]
  onSubmit: (bundleId: string, spaceDid: string, attachedProofs: string[]) => void
}

export default function SpaceShareModal({
  visible,
  onClose,
  bundle,
  availableProofs,
  onSubmit,
}: Props) {
  const [selectedSpaceDid, setSelectedSpaceDid] = useState<string | null>(null)
  const [attachedProofIds, setAttachedProofIds] = useState<string[]>([])
  const [bundleName, setBundleName] = useState('')

  if (!bundle) return null

  const selectedSpace = MOCK_SPACES.find((s) => s.did === selectedSpaceDid)
  const missingProofs = selectedSpace
    ? selectedSpace.requiredProofs.filter(
        (rp) => !availableProofs.some((p) => p.claimType === rp)
      )
    : []
  const canSubmit = selectedSpace && missingProofs.length === 0 && bundleName.trim().length > 0

  const toggleProof = (proofId: string) => {
    setAttachedProofIds((prev) =>
      prev.includes(proofId) ? prev.filter((id) => id !== proofId) : [...prev, proofId]
    )
  }

  const handleSubmit = () => {
    if (!canSubmit || !selectedSpaceDid) return
    onSubmit(bundle.id, selectedSpaceDid, attachedProofIds)
    // Reset
    setSelectedSpaceDid(null)
    setAttachedProofIds([])
    setBundleName('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Share to Space</Text>
              <InfoTooltip
                title="Permissioned Spaces"
                explanation="Spaces are community-governed knowledge pools with membership requirements. Your bundle gets reviewed by moderators before merging into the Trust Mesh. Spaces have their own DID, separate from user DIDs, so ownership can transfer."
              />
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Bundle name */}
            <Text style={styles.label}>Bundle name</Text>
            <TextInput
              style={styles.input}
              value={bundleName}
              onChangeText={setBundleName}
              placeholder="e.g. Energy reform position"
              placeholderTextColor="#6B7280"
            />

            {/* Selected nodes summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                {bundle.nodeIds.length} nodes · {bundle.edgeIds.length} edges
              </Text>
              <Text style={styles.summarySub}>
                {bundle.nodeIds.length > 0
                  ? `${bundle.nodeIds.slice(0, 3).join(', ')}${bundle.nodeIds.length > 3 ? '…' : ''}`
                  : 'No nodes selected'}
              </Text>
            </View>

            {/* Space selector */}
            <Text style={styles.label}>Target space</Text>
            {MOCK_SPACES.map((space) => {
              const isSelected = selectedSpaceDid === space.did
              const hasMissing = space.requiredProofs.some(
                (rp) => !availableProofs.some((p) => p.claimType === rp)
              )
              return (
                <TouchableOpacity
                  key={space.did}
                  style={[
                    styles.spaceCard,
                    isSelected && styles.spaceCardSelected,
                    hasMissing && styles.spaceCardDisabled,
                  ]}
                  onPress={() => !hasMissing && setSelectedSpaceDid(space.did)}
                  disabled={hasMissing}
                >
                  <View style={styles.spaceHeader}>
                    <Text style={styles.spaceName}>{space.name}</Text>
                    {isSelected && <Text style={styles.check}>✓</Text>}
                  </View>
                  <Text style={styles.spaceType}>{space.type.replace('com.para.space.', '')}</Text>
                  <Text style={styles.spaceMeta}>
                    Threshold: {Math.round(space.endorsementThreshold * 100)}% ·{' '}
                    {space.requiredProofs.length > 0
                      ? `Requires: ${space.requiredProofs.join(', ')}`
                      : 'Open to all'}
                  </Text>
                  {hasMissing && (
                    <Text style={styles.missingProofs}>
                      Missing proofs: {space.requiredProofs
                        .filter((rp) => !availableProofs.some((p) => p.claimType === rp))
                        .join(', ')}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })}

            {/* Proof attachment */}
            {selectedSpace && selectedSpace.requiredProofs.length > 0 && (
              <>
                <Text style={styles.label}>Attach identity proofs</Text>
                {availableProofs
                  .filter((p) => selectedSpace.requiredProofs.includes(p.claimType))
                  .map((proof) => (
                    <TouchableOpacity
                      key={proof.id}
                      style={[
                        styles.proofRow,
                        attachedProofIds.includes(proof.id) && styles.proofRowSelected,
                      ]}
                      onPress={() => toggleProof(proof.id)}
                    >
                      <Text style={styles.proofLabel}>{proof.label}</Text>
                      <Text style={styles.proofIssuer}>{proof.issuer}</Text>
                      {attachedProofIds.includes(proof.id) && (
                        <Text style={styles.proofCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
              </>
            )}

            {/* URI preview */}
            {selectedSpace && (
              <View style={styles.uriPreview}>
                <Text style={styles.uriLabel}>URI preview</Text>
                <Text style={styles.uriText}>
                  ats://{selectedSpace.did}/com.para.knowledge.branch/{'<'}
                  bundle-key{'>'}/{'<'}
                  your-did{'>'}/com.para.policy.node/{'<'}
                  rkey{'>'}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.submitText}>
                {missingProofs.length > 0
                  ? `Missing ${missingProofs.length} proof(s)`
                  : 'Submit to space'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  summaryText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  summarySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  spaceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  spaceCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A5F',
  },
  spaceCardDisabled: {
    opacity: 0.5,
  },
  spaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spaceName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  check: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '800',
  },
  spaceType: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  spaceMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
  },
  missingProofs: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  proofRowSelected: {
    borderColor: '#10B981',
    backgroundColor: '#064E3B',
  },
  proofLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  proofIssuer: {
    color: '#94A3B8',
    fontSize: 11,
    marginRight: 8,
  },
  proofCheck: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  uriPreview: {
    backgroundColor: '#0B1120',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  uriLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  uriText: {
    color: '#3B82F6',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#334155',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
})
