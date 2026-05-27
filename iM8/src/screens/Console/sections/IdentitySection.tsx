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
  RenameStatus,
  SurfaceId,
  SurfaceTemplate,
} from '../../../types'
import { SURFACE_META } from '../constants'
import { consoleStyles } from '../styles'

export function IdentitySection({
  activeGrantCount,
  activePersona,
  activeProofCount,
  customSurfaces,
  isVerified,
  onSaveName,
  onSelectPersona,
  onShowSurfaceBuilder,
  onSkipRename,
  onStartVerification,
  personas,
  renameInput,
  renameStatus,
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
  onShowSurfaceBuilder: () => void
  onSkipRename: () => void
  onStartVerification: () => void
  personas: Persona[]
  renameInput: string
  renameStatus: RenameStatus
  savingName: boolean
  session: IdentitySession
  setRenameInput: (value: string) => void
}) {
  const surfaces = [...session.surfaceTemplates, ...customSurfaces]

  return (
    <View style={consoleStyles.stack}>
      <View style={consoleStyles.heroCard}>
        <Text style={styles.eyebrow}>Identity</Text>
        <Text style={styles.heroTitle}>
          {isVerified ? 'Your identity is verified.' : 'Verify to unlock civic participation.'}
        </Text>
        <Text style={styles.heroBody}>
          {isVerified
            ? 'Your central identity is verified. Choose a card to participate in PARA — each card is a face, but your vote is always one.'
            : 'Verification unlocks PARA civic proofs, voting rights, and your public name choice. Your raw documents are never shared.'}
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
        <Text style={consoleStyles.sectionTitle}>One vote. Guaranteed.</Text>
        <Text style={consoleStyles.sectionBody}>
          No matter how many cards you use, your central private identity ensures you can only vote once per policy. Multiple faces, one voice, one vote.
        </Text>
      </View>

      <View style={consoleStyles.listBlock}>
        <SectionHeading title="Your cards" detail="Up to 3 personas. Tap to activate." />
        {personas.map((persona) => (
          <PersonaCard
            key={persona.id}
            active={persona.id === activePersona?.id}
            onPress={() => onSelectPersona(persona.id)}
            persona={persona}
          />
        ))}
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
    case 'para': return 'PARA'
    case 'independent': return 'Independent'
    case 'public': return 'Public'
  }
}

function kindColor(kind: PersonaKind): string {
  switch (kind) {
    case 'para': return tokens.accent
    case 'independent': return tokens.warning
    case 'public': return tokens.success
  }
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
})
