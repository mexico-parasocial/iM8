import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { EmptyState, SectionHeading, consoleStyles } from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { tokens } from '../../../theme'
import type { IdentitySession, Persona, SocialLink, SocialProvider } from '../../../types'

export function PublicLinksCard({
  onLinkPublicSocial,
  onUnlinkPublicSocial,
  session,
}: {
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
  onUnlinkPublicSocial: (id: string) => Promise<void>
  session: IdentitySession
}) {
  const activePublicLinks = (session.publicLinks ?? []).filter((link) => link.status === 'linked')
  const publicPersona = session.publicPersonaId
    ? session.personas.find((persona) => persona.id === session.publicPersonaId)
    : session.personas.find((persona) => persona.kind === 'public')

  return (
    <View style={consoleStyles.listBlock}>
      <SectionHeading
        title="Public links"
        detail="Social accounts attach to the public card only. Anonymous cards and the private civic root stay separate, and these links never change durable PARA policy."
      />
      {activePublicLinks.length > 0 ? (
        activePublicLinks.map((link) => (
          <PublicLinkRow
            key={link.id}
            link={link}
            publicPersona={publicPersona}
            onUnlinkPublicSocial={onUnlinkPublicSocial}
          />
        ))
      ) : (
        <EmptyState
          icon="globe"
          title="No public socials linked"
          detail="The public card exists without Instagram, X, or Bluesky attached."
        />
      )}
      <PublicLinkComposer onLinkPublicSocial={onLinkPublicSocial} />
    </View>
  )
}

const SOCIAL_PROVIDERS: { id: SocialProvider; label: string; placeholder: string }[] = [
  { id: 'instagram', label: 'Instagram', placeholder: 'instagram_handle' },
  { id: 'x', label: 'X', placeholder: 'x_handle' },
  { id: 'bsky', label: 'Bluesky', placeholder: 'handle.bsky.social' },
]

function providerLabel(provider: SocialProvider) {
  if (provider === 'bsky') return 'Bluesky'
  if (provider === 'x') return 'X'
  return 'Instagram'
}

function PublicLinkRow({
  link,
  publicPersona,
  onUnlinkPublicSocial,
}: {
  link: SocialLink
  publicPersona: Persona | undefined
  onUnlinkPublicSocial: (id: string) => Promise<void>
}) {
  return (
    <View style={rowStyle('default')}>
      <View style={rowStyles.text}>
        <Text style={rowStyles.title}>{providerLabel(link.provider)} linked locally</Text>
        <Text style={rowStyles.detail}>
          @{link.handle} created {publicPersona?.name ?? 'public card'}. Exposes selected public proofs only.
        </Text>
        <Text style={styles.separationNote}>Not linked to anonymous cards.</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={pillStyle('success')}>
          <Text style={pillTextStyle('success')}>Linked</Text>
        </View>
        <Pressable onPress={() => void onUnlinkPublicSocial(link.id)} style={styles.unlinkButton}>
          <Text style={styles.unlinkText}>Unlink</Text>
        </Pressable>
      </View>
    </View>
  )
}

function PublicLinkComposer({
  onLinkPublicSocial,
}: {
  onLinkPublicSocial: (provider: SocialProvider, handle: string) => Promise<void>
}) {
  const [provider, setProvider] = useState<SocialProvider>('instagram')
  const [handle, setHandle] = useState('')
  const activeProvider = SOCIAL_PROVIDERS.find((item) => item.id === provider) ?? SOCIAL_PROVIDERS[0]

  return (
    <View style={styles.composer}>
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
      <View style={styles.inputRow}>
        <Icon name="globe" size={18} color={tokens.accentSoft} />
        <TextInput
          value={handle}
          onChangeText={setHandle}
          style={styles.input}
          placeholder={activeProvider.placeholder}
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <Pressable
        onPress={() => {
          void onLinkPublicSocial(provider, handle)
          setHandle('')
        }}
        disabled={!handle.trim()}
        style={[buttonStyle('primary'), !handle.trim() && styles.disabled]}
      >
        <Text style={buttonTextStyle('primary')}>Link social to public card</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  separationNote: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  composer: {
    gap: 8,
    marginTop: 4,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surfaceRaised,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: tokens.text,
    paddingVertical: 13,
    fontSize: 16,
  },
  unlinkButton: {
    paddingVertical: 2,
  },
  unlinkText: {
    color: tokens.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
})
