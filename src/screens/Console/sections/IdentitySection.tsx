import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { Icon } from '../../../components/m8/Icon'
import {
  Metric,
  SectionHeading,
  SimpleRow,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { UserAvatar } from '../../../components/m8/UserAvatar'
import { tokens } from '../../../theme'
import type {
  IdentitySession,
  NewSurfaceInput,
  Persona,
  PersonaKind,
  ProofArtifact,
  RenameStatus,
  SocialProvider,
  SurfaceId,
  SurfaceTemplate,
} from '../../../types'
import { SURFACE_META } from '../constants'
import { consoleStyles } from '../styles'
import { ParaSection } from './ParaSection'

export function IdentitySection({
  activeGrantCount,
  activePersona,
  activeProofCount,
  customSurfaces,
  isVerified,
  onSaveName,
  onSelectPersona,
  onCreatePublicPersona,
  onLinkPublicSocial,
  onApprovePolicyChange,
  onApplyPolicyChange,
  onRejectPolicyChange,
  onRequestParaGrant,
  onShowSurfaceBuilder,
  onSkipRename,
  onStartVerification,
  personas,
  proofArtifacts,
  renameInput,
  renameStatus,
  requestingPara,
  savingName,
  session,
  setRenameInput,
}: {
  activeGrantCount: number
  activePersona: Persona | undefined
  activeProofCount: number
  customSurfaces: NewSurfaceInput[]
  isVerified: boolean
  onSaveName: () => Promise<void>
  onSelectPersona: (id: string) => void
  onCreatePublicPersona: (displayName: string) => Promise<void>
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
  onApprovePolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onApplyPolicyChange: (requestId: string) => Promise<void>
  onRejectPolicyChange: (requestId: string, adminDid: string) => Promise<void>
  onRequestParaGrant: () => Promise<void>
  onShowSurfaceBuilder: () => void
  onSkipRename: () => void
  onStartVerification: () => void
  personas: Persona[]
  proofArtifacts: ProofArtifact[]
  renameInput: string
  renameStatus: RenameStatus
  requestingPara: boolean
  savingName: boolean
  session: IdentitySession
  setRenameInput: (value: string) => void
}) {
  const surfaces = [...session.surfaceTemplates, ...customSurfaces]
  const anonymousPersonas = personas.filter((persona) => persona.kind === 'anonymous')
  const publicPersonas = personas.filter((persona) => persona.kind === 'public')

  return (
    <View style={consoleStyles.stack}>
      <View style={consoleStyles.heroCard}>
        <Text style={styles.eyebrow}>Identity wallet</Text>
        <Text style={styles.heroTitle}>
          {isVerified ? 'Your civic root is verified.' : 'Verify the private root to unlock civic participation.'}
        </Text>
        <Text style={styles.heroBody}>
          {isVerified
            ? 'Choose a card for each context. The root stays hidden, enforces one vote, and only issues the proofs you approve.'
            : 'Verification unlocks PARA civic proofs and voting rights. Your raw documents are never shared.'}
        </Text>
        <ProgressRail isVerified={isVerified} renameStatus={renameStatus} />
        {!isVerified ? (
          <Pressable onPress={onStartVerification} style={[buttonStyle('primary'), consoleStyles.fullButton]}>
            <Text style={buttonTextStyle('primary')}>Verify identity</Text>
          </Pressable>
        ) : null}
      </View>

      {isVerified && renameStatus === 'available' ? (
        <View style={cardStyle('filled')}>
          <View style={consoleStyles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={consoleStyles.sectionTitle}>Choose your public name</Text>
              <Text style={consoleStyles.sectionBody}>
                You can keep the private handle or save one verified display name for PARA.
              </Text>
            </View>
            <Icon name="pencil" size={22} color={tokens.accentSoft} />
          </View>
          <TextInput
            value={renameInput}
            onChangeText={setRenameInput}
            style={consoleStyles.input}
            placeholder="Public name"
            placeholderTextColor={tokens.muted}
          />
          <View style={consoleStyles.actionRow}>
            <Pressable onPress={onSkipRename} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>Keep private</Text>
            </Pressable>
            <Pressable onPress={() => void onSaveName()} style={buttonStyle('primary')}>
              {savingName ? (
                <ActivityIndicator color={tokens.onAccent} />
              ) : (
                <Text style={buttonTextStyle('primary')}>Save and use PARA</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={consoleStyles.metricRow}>
        <Metric label="Proofs" value={String(activeProofCount)} />
        <Metric label="Apps" value={String(activeGrantCount)} />
        <Metric label="PARA" value={session.paraProvider.availability} />
      </View>

      <View style={[cardStyle('accent'), { marginBottom: 6 }]}>
        <View style={consoleStyles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={consoleStyles.sectionTitle}>Private civic root</Text>
            <Text style={consoleStyles.sectionBody}>
              Hidden authority for one vote, recovery, and proof issuance. It is not a card and never appears as a public profile.
            </Text>
          </View>
          <Icon name="lock" size={22} color={tokens.accentSoft} />
        </View>
      </View>

      <View style={[cardStyle('accent'), { marginBottom: 6 }]}>
        <Text style={consoleStyles.sectionTitle}>One vote. Guaranteed.</Text>
        <Text style={consoleStyles.sectionBody}>
          No matter how many cards you create, the private root ensures you can only vote once per policy. Multiple faces, one voice, one vote.
        </Text>
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Anonymous cards" detail="Separate names. No public social link unless you choose one." />
        {anonymousPersonas.map((persona) => (
          <PersonaCard
            key={persona.id}
            active={persona.id === activePersona?.id}
            onPress={() => onSelectPersona(persona.id)}
            persona={persona}
          />
        ))}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Public identity" detail="Only created after you link a social or make one manually." />
        {publicPersonas.length > 0 ? (
          publicPersonas.map((persona) => (
            <PersonaCard
              key={persona.id}
              active={persona.id === activePersona?.id}
              onPress={() => onSelectPersona(persona.id)}
              persona={persona}
            />
          ))
        ) : (
          <PublicIdentityEmpty
            onCreatePublicPersona={onCreatePublicPersona}
            onLinkPublicSocial={onLinkPublicSocial}
          />
        )}
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Surfaces" detail="Surfaces replace the old global switcher with clear sharing contexts." />
        {surfaces.map((surface) => (
          <SurfaceCard key={surface.id} surface={surface} />
        ))}
        <Pressable onPress={onShowSurfaceBuilder} style={[buttonStyle('secondary'), consoleStyles.fullButton]}>
          <Text style={buttonTextStyle('secondary')}>Create surface</Text>
        </Pressable>
      </View>

      <ParaSection
        embedded
        isVerified={isVerified}
        onApprovePolicyChange={onApprovePolicyChange}
        onApplyPolicyChange={onApplyPolicyChange}
        onRejectPolicyChange={onRejectPolicyChange}
        onRequestParaGrant={onRequestParaGrant}
        onStartVerification={onStartVerification}
        proofArtifacts={proofArtifacts}
        requestingPara={requestingPara}
        session={session}
      />

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Session record" detail="Technical details for recovery and app compatibility." />
        <SimpleRow icon="person" title="Display name" detail={session.displayName} meta="Local" />
        <SimpleRow icon="shield" title="DID" detail={session.did} meta="Portable" />
        <SimpleRow icon="globe" title="Auth server" detail={session.authorizationServer} meta={session.brokerMode} />
      </View>
    </View>
  )
}

function ProgressRail({
  isVerified,
  renameStatus,
}: {
  isVerified: boolean
  renameStatus: RenameStatus
}) {
  const steps = [
    { label: 'Create', done: true },
    { label: 'Verify', done: isVerified },
    { label: 'Name', done: renameStatus === 'used' },
    { label: 'PARA', done: isVerified && renameStatus !== 'available' },
  ]

  return (
    <View style={consoleStyles.progressRail}>
      {steps.map((step) => (
        <View key={step.label} style={consoleStyles.progressStep}>
          <View style={[consoleStyles.progressDot, step.done && consoleStyles.progressDotDone]}>
            {step.done ? <Icon name="check" size={12} color={tokens.onAccent} /> : null}
          </View>
          <Text style={[consoleStyles.progressLabel, step.done && consoleStyles.progressLabelDone]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

function kindLabel(kind: PersonaKind): string {
  switch (kind) {
    case 'anonymous': return 'Anonymous'
    case 'public': return 'Public'
  }
}

function kindColor(kind: PersonaKind): string {
  switch (kind) {
    case 'anonymous': return tokens.accent
    case 'public': return tokens.success
  }
}

const SOCIAL_PROVIDERS: { id: SocialProvider; label: string; placeholder: string }[] = [
  { id: 'instagram', label: 'Instagram', placeholder: 'instagram_handle' },
  { id: 'x', label: 'X', placeholder: 'x_handle' },
  { id: 'bsky', label: 'Bluesky', placeholder: 'handle.bsky.social' },
]

function PublicIdentityEmpty({
  onCreatePublicPersona,
  onLinkPublicSocial,
}: {
  onCreatePublicPersona: (displayName: string) => Promise<void>
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
}) {
  const [provider, setProvider] = useState<SocialProvider>('instagram')
  const [handle, setHandle] = useState('')
  const [manualName, setManualName] = useState('')
  const activeProvider = SOCIAL_PROVIDERS.find((item) => item.id === provider) ?? SOCIAL_PROVIDERS[0]

  return (
    <View style={styles.emptyPublicCard}>
      <View style={consoleStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={consoleStyles.cardTitle}>No public identity yet</Text>
          <Text style={consoleStyles.cardBodyText}>
            Link Instagram, X, or Bluesky to create one. Anonymous cards stay separate.
          </Text>
        </View>
        <Icon name="globe" size={22} color={tokens.success} />
      </View>

      <View style={styles.providerRow}>
        {SOCIAL_PROVIDERS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setProvider(item.id)}
            style={[styles.providerChip, provider === item.id && styles.providerChipActive]}
          >
            <Text style={[styles.providerText, provider === item.id && styles.providerTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={handle}
        onChangeText={setHandle}
        style={consoleStyles.input}
        placeholder={activeProvider.placeholder}
        placeholderTextColor={tokens.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={() => {
          void onLinkPublicSocial(provider, handle)
          setHandle('')
        }}
        disabled={!handle.trim()}
        style={[buttonStyle('primary'), consoleStyles.fullButton, !handle.trim() && styles.disabled]}
      >
        <Text style={buttonTextStyle('primary')}>Link and create public card</Text>
      </Pressable>

      <TextInput
        value={manualName}
        onChangeText={setManualName}
        style={consoleStyles.input}
        placeholder="public-card-name"
        placeholderTextColor={tokens.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={() => {
          void onCreatePublicPersona(manualName)
          setManualName('')
        }}
        disabled={!manualName.trim()}
        style={[buttonStyle('secondary'), consoleStyles.fullButton, !manualName.trim() && styles.disabled]}
      >
        <Text style={buttonTextStyle('secondary')}>Create public card without linking</Text>
      </Pressable>
    </View>
  )
}

function PersonaCard({
  active,
  onPress,
  persona,
}: {
  active: boolean
  onPress: () => void
  persona: Persona
}) {
  const kColor = kindColor(persona.kind)
  return (
    <Pressable onPress={onPress} style={[consoleStyles.personaCard, active && { borderColor: kColor + '80', borderWidth: 2 }]}>
      <View style={consoleStyles.rowBetween}>
        <UserAvatar
          uri={persona.avatar}
          size={44}
          fallback={persona.name}
          borderColor={active ? kColor : undefined}
        />
        <StatusPill label={active ? 'Active' : kindLabel(persona.kind)} tone={active ? 'success' : 'neutral'} />
      </View>
      <Text style={consoleStyles.cardTitle}>{persona.name}</Text>
      <Text style={consoleStyles.cardMeta}>{persona.role}</Text>
      <Text style={consoleStyles.cardBodyText}>{persona.oneLine}</Text>
      {persona.galleryPlan ? (
        <View style={styles.galleryPlan}>
          <Icon name="grid" size={16} color={tokens.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.galleryPlanTitle}>Instagram gallery ready</Text>
            <Text style={styles.galleryPlanText}>
              {persona.galleryPlan.embedType} · up to {persona.galleryPlan.maxItems} images
            </Text>
          </View>
        </View>
      ) : null}
      <View style={consoleStyles.surfaceStateRow}>
        {(Object.keys(SURFACE_META) as SurfaceId[]).map((surface) => (
          <View key={surface} style={consoleStyles.surfaceState}>
            <Text style={consoleStyles.surfaceStateLabel}>{SURFACE_META[surface].label}</Text>
            <Text style={consoleStyles.surfaceStateValue}>{persona.surfaceStates[surface]}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  )
}

function SurfaceCard({ surface }: { surface: SurfaceTemplate | NewSurfaceInput }) {
  const base = surface.id in SURFACE_META ? SURFACE_META[surface.id as SurfaceId] : null
  return (
    <View style={consoleStyles.surfaceCard}>
      <View style={[consoleStyles.surfaceIcon, { backgroundColor: (base?.color ?? tokens.accent) + '20' }]}>
        <Icon name={base?.icon ?? 'grid'} size={18} color={base?.color ?? tokens.accentSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={consoleStyles.rowTitle}>{surface.name}</Text>
        <Text style={consoleStyles.rowDetail}>{surface.audience}</Text>
      </View>
      <Text style={consoleStyles.rowMeta}>{surface.status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: tokens.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  heroBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  avatarText: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyPublicCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.glassBorder,
    gap: 8,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  providerChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 9,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
  },
  providerChipActive: {
    backgroundColor: tokens.accentTransparent,
    borderColor: tokens.accentBorder,
  },
  providerText: {
    color: tokens.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  providerTextActive: {
    color: tokens.accentSoft,
  },
  disabled: {
    opacity: 0.5,
  },
  galleryPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 10,
    backgroundColor: tokens.success + '14',
    borderWidth: 1,
    borderColor: tokens.success + '40',
  },
  galleryPlanTitle: {
    color: tokens.text,
    fontSize: 12,
    fontWeight: '800',
  },
  galleryPlanText: {
    color: tokens.muted,
    fontSize: 11,
    marginTop: 2,
  },
})
