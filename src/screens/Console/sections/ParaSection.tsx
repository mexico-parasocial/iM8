import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  ClaimChips,
  consoleStyles,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { describeVerification } from '../../../services/artifactVerification'
import { tokens } from '../../../theme'
import type { IdentitySession, ProofArtifact } from '../../../types'
import { CLAIM_LABELS } from '../constants'

/**
 * PARA as one compact card: lock state, the one CTA, claims as chips, and
 * proof receipts as single rows. The provider telemetry (availability, policy
 * record, sync age) and the fixture integrations list were removed — they
 * described the backend, not anything the user can act on.
 */
export function ParaSection({
  isVerified,
  onRequestParaGrant,
  onStartVerification,
  proofArtifacts,
  requestingPara,
  session,
}: {
  isVerified: boolean
  onRequestParaGrant: () => Promise<void>
  onStartVerification: () => void
  proofArtifacts: ProofArtifact[]
  requestingPara: boolean
  session: IdentitySession
}) {
  const activeProofs = proofArtifacts.filter((proof) => proof.status === 'Active')

  return (
    <View style={styles.paraCard}>
      <View style={consoleStyles.rowBetween}>
        <Text style={consoleStyles.cardTitle}>PARA</Text>
        <StatusPill label={isVerified ? 'Unlocked' : 'Locked'} tone={isVerified ? 'success' : 'neutral'} />
      </View>

      {!isVerified ? (
        <Pressable onPress={onStartVerification} style={buttonStyle('primary')}>
          <Text style={buttonTextStyle('primary')}>Verify before using PARA</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void onRequestParaGrant()}
          disabled={requestingPara}
          style={[buttonStyle('primary'), requestingPara && consoleStyles.disabled]}
        >
          {requestingPara ? (
            <ActivityIndicator color={tokens.onAccent} />
          ) : (
            <Text style={buttonTextStyle('primary')}>Start a PARA proof request</Text>
          )}
        </Pressable>
      )}

      <ClaimChips claims={session.paraProvider.supportedClaims} />

      <View style={styles.receipts}>
        <Text style={styles.receiptsLabel}>Proof receipts</Text>
        {activeProofs.length > 0 ? (
          activeProofs.map((proof) => <ReceiptRow key={proof.id} proof={proof} />)
        ) : (
          <Text style={styles.receiptsEmpty}>
            No receipts yet. Approve a request to create proof-only receipts.
          </Text>
        )}
      </View>
    </View>
  )
}

function ReceiptRow({ proof }: { proof: ProofArtifact }) {
  const verified = proof.verification?.status === 'verified'
  return (
    <View style={consoleStyles.surfaceCard}>
      {/*
        Two different facts, deliberately shown separately. The pill is what
        the broker says about the proof's lifecycle; the second line is
        whether we could confirm the issuer's signature ourselves. Collapsing
        them would put a green tick on an assertion we cannot check.
      */}
      <Icon
        name={verified ? 'shieldCheck' : 'shield'}
        size={18}
        color={verified ? tokens.success : tokens.warning}
      />
      <View style={{ flex: 1 }}>
        <Text style={consoleStyles.rowTitle}>{CLAIM_LABELS[proof.claimType] ?? proof.label}</Text>
        <Text style={consoleStyles.rowDetail}>
          {proof.verification ? describeVerification(proof.verification) : 'Signature not checked'}
        </Text>
      </View>
      <StatusPill label={proof.status} tone={proof.status === 'Active' ? 'success' : 'neutral'} />
    </View>
  )
}

const styles = StyleSheet.create({
  paraCard: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
  },
  receipts: {
    gap: 8,
  },
  receiptsLabel: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  receiptsEmpty: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
})
