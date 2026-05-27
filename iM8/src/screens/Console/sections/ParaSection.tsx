import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  EmptyCard,
  Metric,
  SectionHeading,
  SectionHero,
  SimpleFact,
  SimpleRow,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { tokens } from '../../../theme'
import type { IdentitySession, ProofArtifact } from '../../../types'
import { CLAIM_LABELS } from '../constants'
import { consoleStyles } from '../styles'

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
    <View style={consoleStyles.stack}>
      <SectionHero
        eyebrow="PARA"
        title={isVerified ? 'PARA can use this identity.' : 'Verification unlocks PARA use.'}
        body={session.paraProvider.detail}
        icon="globe"
      />

      {!isVerified ? (
        <Pressable onPress={onStartVerification} style={[buttonStyle('primary'), consoleStyles.fullButton]}>
          <Text style={buttonTextStyle('primary')}>Verify before using PARA</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => void onRequestParaGrant()}
          disabled={requestingPara}
          style={[buttonStyle('primary'), consoleStyles.fullButton, requestingPara && consoleStyles.disabled]}
        >
          {requestingPara ? (
            <ActivityIndicator color={tokens.onAccent} />
          ) : (
            <Text style={buttonTextStyle('primary')}>Start a PARA proof request</Text>
          )}
        </Pressable>
      )}

      <View style={consoleStyles.metricRow}>
        <Metric label="Provider" value={session.paraProvider.availability} />
        <Metric label="Policy" value={session.paraProvider.policyRecord} />
        <Metric label="Sync" value={session.paraProvider.lastSync} />
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Proof receipts" detail="These are the receipts PARA-compatible apps can consume." />
        {activeProofs.length > 0 ? (
          activeProofs.map((proof) => <ProofCard key={proof.id} proof={proof} />)
        ) : (
          <EmptyCard icon="shield" title="No active proof receipts yet" body="Approve a request to create proof-only receipts for PARA and other apps." />
        )}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="PARA claims" detail="Supported proofs for this identity." />
        {session.paraProvider.supportedClaims.map((claim) => (
          <SimpleRow
            key={claim}
            icon="check"
            title={CLAIM_LABELS[claim] ?? claim}
            detail="Available as proof-only output"
            meta="PARA"
          />
        ))}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Connected apps" detail="Apps that know how to ask m8 for bounded proofs." />
        {session.integrations.map((integration) => (
          <SimpleRow
            key={integration.id}
            icon="globe"
            title={integration.name}
            detail={integration.summary}
            meta={integration.status}
          />
        ))}
      </View>
    </View>
  )
}

function ProofCard({ proof }: { proof: ProofArtifact }) {
  return (
    <View style={consoleStyles.receiptCard}>
      <View style={consoleStyles.rowBetween}>
        <Text style={consoleStyles.cardTitle}>{CLAIM_LABELS[proof.claimType] ?? proof.label}</Text>
        <StatusPill label={proof.status} tone={proof.status === 'Active' ? 'success' : 'neutral'} />
      </View>
      <Text style={consoleStyles.cardBodyText}>{proof.summary}</Text>
      <SimpleFact label="Issuer" value={proof.issuer} />
      <SimpleFact label="Audience" value={proof.audienceAppId} />
      <SimpleFact label="Expires" value={proof.expiresAt} />
    </View>
  )
}

const styles = StyleSheet.create({})
