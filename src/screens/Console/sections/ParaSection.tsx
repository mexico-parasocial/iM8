import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  ClaimChips,
  consoleStyles,
  StatRow,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { PARA_GATED_SPACES, gatedSpaceFor } from '../../../contracts/gatedSpaces'
import { evaluateProofGate } from '../../../services/proofGate'
import { formatSpaceUri } from '../../../services/atproto/spaceClient'
import { summarizeParaHub } from '../../../services/paraHub'
import { tokens } from '../../../theme'
import { hapticLight } from '../../../utils/haptics'
import type { IdentitySession } from '../../../types'

/**
 * PARA as the civic-power hero: verification state, the one vote guarantee,
 * provider status, the one CTA, supported claims, the About explainer, and a
 * stat row over the ledgers below. The per-surface PARA controls live in
 * SurfaceDetailCard and the ledgers live in this same tab beneath the hub —
 * the hero summarizes, never copies.
 */
export function ParaSection({
  isVerified,
  onRequestParaGrant,
  onStartVerification,
  requestingPara,
  session,
}: {
  isVerified: boolean
  onRequestParaGrant: () => Promise<void>
  onStartVerification: () => void
  requestingPara: boolean
  session: IdentitySession
}) {
  const [showAbout, setShowAbout] = useState(false)

  const activeProofs = session.proofArtifacts.filter((proof) => proof.status === 'Active')
  const activeGrants = session.grants.filter((grant) => grant.status === 'Active')
  const admittedSpaces = PARA_GATED_SPACES.filter(
    (spec) =>
      evaluateProofGate({
        requiredClaims: spec.requiredClaims,
        artifacts: session.proofArtifacts,
        audience: formatSpaceUri(gatedSpaceFor(spec, session.did)),
      }).admitted,
  ).length
  const summary = summarizeParaHub({
    isVerified,
    activeReceiptCount: activeProofs.length,
    activeGrantCount: activeGrants.length,
    admittedSpaceCount: admittedSpaces,
    totalSpaceCount: PARA_GATED_SPACES.length,
  })
  const provider = session.paraProvider

  return (
    <View style={styles.paraCard}>
      <View style={consoleStyles.rowBetween}>
        <Text style={consoleStyles.cardTitle}>PARA</Text>
        <StatusPill label={summary.statusLabel} tone={summary.statusTone} />
      </View>
      <Text style={styles.voteLine}>
        One vote per policy — guaranteed by your private root.
      </Text>
      <Text style={styles.providerLine}>
        {provider.availability} · Synced {provider.lastSync}
      </Text>

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

      <ClaimChips claims={provider.supportedClaims} />

      <Pressable
        onPress={() => {
          hapticLight()
          setShowAbout((current) => !current)
        }}
        accessibilityRole="button"
        accessibilityLabel="What is PARA?"
        accessibilityState={{ expanded: showAbout }}
        style={styles.aboutRow}
      >
        <Text style={styles.aboutTitle}>What is PARA?</Text>
        <View style={{ transform: [{ rotate: showAbout ? '90deg' : '0deg' }] }}>
          <Icon name="chevronRight" size={14} color={tokens.muted} />
        </View>
      </Pressable>
      {showAbout ? (
        <View style={styles.aboutBody}>
          <Text style={styles.aboutLine}>
            Your private root holds one civic identity. It is never a profile.
          </Text>
          <Text style={styles.aboutLine}>
            Cards are faces of that root: public, or anonymous PARA cards.
          </Text>
          <Text style={styles.aboutLine}>
            Apps receive proofs about you — never the underlying records.
          </Text>
        </View>
      ) : null}

      <View style={styles.jumpDivider} />

      <StatRow
        stats={[
          { label: 'Receipts', value: summary.receiptsLabel },
          { label: 'App grants', value: summary.appsLabel },
          { label: 'Gated spaces', value: summary.spacesLabel },
        ]}
      />
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
  voteLine: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  providerLine: {
    color: tokens.muted,
    fontSize: 12,
    marginTop: -8,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  aboutTitle: {
    color: tokens.accentSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  aboutBody: {
    gap: 6,
    marginTop: -4,
  },
  aboutLine: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  jumpDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.glassBorder,
  },
})
