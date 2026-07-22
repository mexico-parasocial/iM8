import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import {
  consoleStyles,
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

export function ParaSection({
  embedded = false,
  isVerified,
  onRequestParaGrant,
  onStartVerification,
  proofArtifacts,
  requestingPara,
  session,
}: {
  embedded?: boolean
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
      {embedded ? (
        <View style={consoleStyles.listBlock}>
          <SectionHeading
            title="PARA"
            detail="Proof use and connected apps for this wallet."
          />
        </View>
      ) : (
        <SectionHero
          eyebrow="PARA"
          title={isVerified ? 'Selected card can request PARA proofs.' : 'Verification unlocks PARA use.'}
          body={session.paraProvider.detail}
          icon="globe"
        />
      )}

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
        <SectionHeading title="PARA claims" detail="Supported proofs for the selected card, backed by the private root." />
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
        <SectionHeading title="Connected apps" detail="Apps that know how to ask iM8 for bounded proofs." />
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
