import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  consoleStyles,
  EmptyCard,
  SectionHeading,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { describeVerification } from '../../../services/artifactVerification'
import { PARA_GATED_SPACES, gatedSpaceFor } from '../../../contracts/gatedSpaces'
import { proofBrokerClaimLabel } from '../../../contracts/proofBroker'
import { evaluateProofGate } from '../../../services/proofGate'
import { formatSpaceUri } from '../../../services/atproto/spaceClient'
import { tokens } from '../../../theme'
import type {
  AppGrant,
  ClaimRequest,
  IdentitySession,
  Persona,
  PolicyChangeRequest,
  ProofArtifact,
  SocialProvider,
} from '../../../types'
import { CLAIM_LABELS } from '../constants'
import { GrantCard, RequestCard } from './RequestsSection'
import { PublicLinksCard } from './PublicLinksCard'
import { GovernanceSection } from './GovernanceSection'

export function CredentialsSection({
  activePersona,
  grants,
  onApproveGrant,
  onApprovePolicyChange,
  onApplyPolicyChange,
  onLinkPublicSocial,
  onRejectPolicyChange,
  onRevokeGrant,
  onUnlinkPublicSocial,
  pendingRequests,
  policyChangeRequests,
  proofArtifacts,
  session,
  surfaceLabel,
}: {
  activePersona: Persona | undefined
  grants: AppGrant[]
  onApproveGrant: (id: string) => Promise<void>
  onApprovePolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onApplyPolicyChange: (requestId: string) => Promise<void>
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
  onRejectPolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onRevokeGrant: (id: string) => Promise<void>
  onUnlinkPublicSocial: (id: string) => Promise<void>
  pendingRequests: ClaimRequest[]
  policyChangeRequests: PolicyChangeRequest[]
  proofArtifacts: ProofArtifact[]
  session: IdentitySession
  surfaceLabel: string
}) {
  const [expandedSpace, setExpandedSpace] = useState<string | null>(null)
  const activeProofs = proofArtifacts.filter((p) => p.status === 'Active')

  return (
    <View style={consoleStyles.stack}>
      {/* Pending claim requests */}
      <View style={consoleStyles.listBlock}>
        <SectionHeading title={`Pending requests \u2014 ${surfaceLabel}`} detail="Apps receive proofs only after you approve." />
        {pendingRequests.length > 0 ? (
          pendingRequests.map((request) => (
            <RequestCard key={request.id} request={request} onApprove={onApproveGrant} />
          ))
        ) : (
          <EmptyCard icon="check" title="Nothing pending" body="New app requests will appear here with plain-language proof details." />
        )}
      </View>

      {/* Community governance */}
      <GovernanceSection
        onApprovePolicyChange={onApprovePolicyChange}
        onApplyPolicyChange={onApplyPolicyChange}
        onRejectPolicyChange={onRejectPolicyChange}
        session={session}
      />

      {/* Proof receipts */}
      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Proof receipts" detail="Signed claims issued through PARA." />
        {activeProofs.length > 0 ? (
          activeProofs.map((proof) => <ReceiptRow key={proof.id} proof={proof} />)
        ) : (
          <EmptyCard icon="shield" title="No receipts yet" body="Approve a request to create proof-only receipts." />
        )}
      </View>

      {/* Active grants */}
      <View style={consoleStyles.listBlock}>
        <SectionHeading title={`Active grants \u2014 ${surfaceLabel}`} detail="Every permission you've granted stays visible." />
        {grants.length > 0 ? (
          grants.map((grant) => (
            <GrantCard key={grant.id} grant={grant} onRevoke={onRevokeGrant} />
          ))
        ) : (
          <EmptyCard icon="check" title="No grants" body="Grants appear here after you approve proof requests." />
        )}
      </View>

      {/* Gated spaces */}
      <View style={consoleStyles.listBlock}>
        <SectionHeading
          title="Gated spaces"
          detail="PARA spaces on the permissioned-spaces alpha. Admission is decided by your proofs."
        />
        {PARA_GATED_SPACES.map((spec) => {
          const evaluation = evaluateProofGate({
            requiredClaims: spec.requiredClaims,
            artifacts: session.proofArtifacts,
            audience: formatSpaceUri(gatedSpaceFor(spec, session.did)),
          })
          const missing = evaluation.claims.filter((claim) => claim.state === 'missing')
          const pillVariant = evaluation.admitted
            ? 'success'
            : missing.length > 0
              ? 'danger'
              : 'warning'
          const expanded = expandedSpace === spec.spaceType
          return (
            <Pressable
              key={spec.spaceType}
              onPress={() => setExpandedSpace(expanded ? null : spec.spaceType)}
              accessibilityRole="button"
              accessibilityLabel={`${spec.name}: ${evaluation.admitted ? 'admitted' : 'not admitted'}`}
            >
              <View style={rowStyle('default')}>
                <View style={rowStyles.text}>
                  <Text style={rowStyles.title}>{spec.name}</Text>
                  <Text style={rowStyles.detail}>{spec.detail}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={pillStyle(pillVariant)}>
                      <Text style={pillTextStyle(pillVariant)}>
                        {evaluation.admitted ? 'Admitted' : 'Not admitted'}
                      </Text>
                    </View>
                    <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                      <Icon name="chevronRight" size={14} color={tokens.muted} />
                    </View>
                  </View>
                  {expanded ? (
                    <Text style={{ color: tokens.muted, fontSize: 11 }}>
                      {evaluation.claims
                        .map((claim) => {
                          const glyph =
                            claim.state === 'satisfied' ? '✓' : claim.state === 'missing' ? '✗' : '⚠'
                          return `${glyph} ${proofBrokerClaimLabel(claim.claimType)}`
                        })
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Social links — public persona only */}
      {activePersona?.kind === 'public' && (
        <PublicLinksCard
          onLinkPublicSocial={onLinkPublicSocial}
          onUnlinkPublicSocial={onUnlinkPublicSocial}
          session={session}
        />
      )}
    </View>
  )
}

function ReceiptRow({ proof }: { proof: ProofArtifact }) {
  const verified = proof.verification?.status === 'verified'
  return (
    <View style={consoleStyles.surfaceCard}>
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
