import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { Icon } from '../../../components/m8/Icon'
import {
  consoleStyles,
  SectionHeading,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { UserAvatar } from '../../../components/m8/UserAvatar'
import {
  getAnonymousIdentities,
  type AnonymousVoiceCard,
} from '../../../services/brokerApi'
import { tokens } from '../../../theme'
import { hapticLight } from '../../../utils/haptics'
import type {
  IdentitySession,
  NewSurfaceInput,
  Persona,
  PersonaKind,
  RenameStatus,
  SocialProvider,
  SurfaceId,
  SurfaceState,
  SurfaceTemplate,
} from '../../../types'
import { SURFACE_META } from '../constants'
import { SurfaceDetailCard } from './SurfaceDetailCard'

export function IdentitySection({
  activePersona,
  customSurfaces,
  surfaceOverrides,
  isVerified,
  onRequestParaGrant,
  onSaveName,
  onCreatePublicPersona,
  onLinkPublicSocial,
  onShowSurfaceBuilder,
  onEditSurface,
  onSkipRename,
  onStartVerification,
  onToggleSignalSurface,
  onUpdateSurfaceState,
  publicSlotActive,
  renameInput,
  renameStatus,
  requestingPara,
  savingName,
  session,
  setRenameInput,
}: {
  activePersona: Persona | undefined
  customSurfaces: NewSurfaceInput[]
  surfaceOverrides: Record<string, Record<string, unknown>>
  isVerified: boolean
  onRequestParaGrant: () => Promise<void>
  onSaveName: () => Promise<void>
  onCreatePublicPersona: (displayName: string) => Promise<void>
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
  onShowSurfaceBuilder: () => void
  onEditSurface: (surface: SurfaceTemplate | NewSurfaceInput) => void
  onSkipRename: () => void
  onStartVerification: () => void
  onToggleSignalSurface: (signalLabel: string, surfaceId: SurfaceId) => void
  onUpdateSurfaceState: (personaId: string, surface: SurfaceId, state: SurfaceState) => Promise<void>
  publicSlotActive: boolean
  renameInput: string
  renameStatus: RenameStatus
  requestingPara: boolean
  savingName: boolean
  session: IdentitySession
  setRenameInput: (value: string) => void
}) {
  const baseSurfaces = [...session.surfaceTemplates, ...customSurfaces]
  const surfaces = baseSurfaces.map((s) => {
    const override = surfaceOverrides[s.id]
    return override ? { ...s, ...override } : s
  })
  const [expandedSurface, setExpandedSurface] = useState<string | null>(null)

  // Live tiered voices from the broker (main voice vs burner identities).
  // Silently absent in local demo mode where no broker session exists.
  const [voices, setVoices] = useState<AnonymousVoiceCard[] | null>(null)
  useEffect(() => {
    let cancelled = false
    getAnonymousIdentities()
      .then((cards) => {
        if (!cancelled) setVoices(cards)
      })
      .catch(() => {
        if (!cancelled) setVoices(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <View style={consoleStyles.stack}>
      {/*
        Card-first: the persona card is the hero of the wallet. The only
        chrome above it is the verification rail while onboarding is
        incomplete — once verified, the section is cards all the way down.
      */}
      {!isVerified ? (
        <View style={cardStyle('warning')}>
          <ProgressRail isVerified={isVerified} renameStatus={renameStatus} />
          <Pressable onPress={onStartVerification} style={[buttonStyle('primary'), consoleStyles.fullButton]}>
            <Text style={buttonTextStyle('primary')}>Verify identity</Text>
          </Pressable>
        </View>
      ) : null}

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

      {publicSlotActive ? (
        <View style={consoleStyles.listBlock}>
          <SectionHeading
            title="Public identity"
            detail="Only created after you link a social or make one manually."
          />
          <PublicIdentityEmpty
            onCreatePublicPersona={onCreatePublicPersona}
            onLinkPublicSocial={onLinkPublicSocial}
          />
        </View>
      ) : activePersona ? (
        <>
          <View style={consoleStyles.listBlock}>
            <SectionHeading
              title={activePersona.kind === 'public' ? 'Public card' : 'Anonymous card'}
              detail={
                activePersona.kind === 'public'
                  ? 'Your public face across the network. Social links attach here only.'
                  : 'Separate names. No public social link unless you choose one.'
              }
            />
            <PersonaCard
              active
              onCycleSurfaceState={(surface) => {
                const order: SurfaceState[] = ['Live', 'Limited', 'Muted']
                const current = activePersona.surfaceStates[surface]
                const next = order[(order.indexOf(current) + 1) % order.length]
                void onUpdateSurfaceState(activePersona.id, surface, next)
              }}
              persona={activePersona}
            />
          </View>

          <View style={consoleStyles.listBlock}>
            <SectionHeading title="Surfaces" detail="Tap a surface to expand and choose what to share." />
            {surfaces.map((surface) => (
              <SurfaceDetailCard
                key={surface.id}
                surface={surface}
                isExpanded={expandedSurface === surface.id}
                onToggle={() => setExpandedSurface(expandedSurface === surface.id ? null : surface.id)}
                onEdit={() => onEditSurface(surface)}
                persona={activePersona}
                isVerified={isVerified}
                onStartVerification={onStartVerification}
                onRequestParaGrant={onRequestParaGrant}
                requestingPara={requestingPara}
                supportedClaims={session.paraProvider.supportedClaims}
                onToggleSignalSurface={onToggleSignalSurface}
              />
            ))}
            <Pressable onPress={onShowSurfaceBuilder} style={[buttonStyle('secondary'), consoleStyles.fullButton]}>
              <Text style={buttonTextStyle('secondary')}>Create surface</Text>
            </Pressable>
          </View>

          {activePersona.kind === 'anonymous' && voices && voices.length > 0 ? (
            <View style={consoleStyles.listBlock}>
              <SectionHeading
                title="Your voices"
                detail="The main voice can be followed and earns karma. Burner voices stay unlinkable and can never be followed."
              />
              {voices.map((card) => (
                <View key={card.id} style={consoleStyles.surfaceCard}>
                  <View
                    style={[
                      consoleStyles.surfaceIcon,
                      {
                        backgroundColor:
                          card.tier === 'main' ? tokens.accentTransparent : tokens.surfaceRaised,
                        borderRadius: 19,
                      },
                    ]}>
                    <Icon
                      name={card.tier === 'main' ? 'shieldCheck' : 'eyeSlash'}
                      size={18}
                      color={card.tier === 'main' ? tokens.accentSoft : tokens.muted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={consoleStyles.rowTitle}>{card.displayName}</Text>
                    <Text style={consoleStyles.rowDetail}>
                      {card.tier === 'main'
                        ? 'Main voice · followable'
                        : card.burnAfter === 'post'
                          ? 'Burner · one post, then rotates'
                          : 'Burner · unlinkable, not followable'}
                    </Text>
                  </View>
                  <Text style={consoleStyles.rowMeta}>{card.posts.length} posts</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {/* Guarantees */}
      <View style={cardStyle('accent')}>
        <View style={styles.guaranteeRow}>
          <Icon name="lock" size={16} color={tokens.accentSoft} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>Private civic root</Text>
            <Text style={styles.guaranteeBody}>
              Hidden authority for one vote, recovery, and proof issuance. Never a public profile.
            </Text>
          </View>
        </View>
        <View style={styles.guaranteeRow}>
          <Icon name="shieldCheck" size={16} color={tokens.accentSoft} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>One vote. Guaranteed.</Text>
            <Text style={styles.guaranteeBody}>
              However many cards you create, the root ensures one vote per policy.
            </Text>
          </View>
        </View>
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
  onCycleSurfaceState,
  onPress,
  persona,
}: {
  active: boolean
  onCycleSurfaceState?: (surface: SurfaceId) => void
  onPress?: () => void
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
        {(Object.keys(SURFACE_META) as SurfaceId[]).map((surface) => {
          const state = persona.surfaceStates[surface]
          return (
            <Pressable
              key={surface}
              disabled={!onCycleSurfaceState}
              onPress={() => {
                hapticLight()
                onCycleSurfaceState?.(surface)
              }}
              style={consoleStyles.surfaceState}>
              <Text style={consoleStyles.surfaceStateLabel}>{SURFACE_META[surface].label}</Text>
              <Text style={[consoleStyles.surfaceStateValue, { color: surfaceStateColor(state) }]}>
                {state}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {onCycleSurfaceState ? (
        <Text style={styles.surfaceStateHint}>Tap a surface state to cycle Live → Limited → Muted.</Text>
      ) : null}
    </Pressable>
  )
}

function surfaceStateColor(state: SurfaceState): string {
  switch (state) {
    case 'Live': return tokens.success
    case 'Limited': return tokens.warning
    case 'Muted': return tokens.muted
  }
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
  surfaceStateHint: {
    color: tokens.muted,
    fontSize: 10,
    marginTop: 2,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guaranteeTitle: {
    color: tokens.text,
    fontSize: 14,
    fontWeight: '800',
  },
  guaranteeBody: {
    color: tokens.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
})
