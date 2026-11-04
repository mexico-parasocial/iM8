import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import {
  consoleStyles,
  EmptyCard,
  SectionHeading,
  StatusPill,
} from '../../../components/m8/ConsolePrimitives'
import { Icon } from '../../../components/m8/Icon'
import { rowStyle, rowStyles } from '../../../components/m8/Row'
import { tokens } from '../../../theme'
import { hapticLight } from '../../../utils/haptics'
import {
  filterAppGroups,
  groupGrantsByApp,
  sortAppGroups,
} from '../../../services/appDirectory'
import type { AppGrant } from '../../../types'
import { GrantCard } from './RequestsSection'

/**
 * Connected-apps directory: grants grouped by app, most recently used
 * first, with a free-text filter. Borrowed from the Bluesky
 * oauth-provider-ui Apps page (bluesky-social/atproto#5482) — the app is
 * named by its friendly name, the row carries recency, and expanding it
 * reveals the underlying grants where revocation already lives. The flat
 * grant list below stays untouched for audit.
 */
export function AppsDirectory({
  grants,
  onRevokeGrant,
}: {
  grants: AppGrant[]
  onRevokeGrant: (id: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null)

  const groups = useMemo(
    () => filterAppGroups(sortAppGroups(groupGrantsByApp(grants)), query),
    [grants, query],
  )

  return (
    <View style={consoleStyles.listBlock}>
      <SectionHeading
        title="Connected apps"
        detail="Apps that can use this identity. Revoke any you no longer use."
      />
      {grants.length > 0 ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filter apps"
          placeholderTextColor={tokens.muted}
          accessibilityLabel="Filter apps"
          autoCapitalize="none"
          autoCorrect={false}
          style={consoleStyles.input}
        />
      ) : null}
      {groups.length > 0 ? (
        groups.map((group) => {
          const expanded = expandedAppId === group.appId
          return (
            <View key={group.appId} style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  hapticLight()
                  setExpandedAppId(expanded ? null : group.appId)
                }}
                accessibilityRole="button"
                accessibilityLabel={`${group.appName}: ${group.activeCount > 0 ? 'active' : 'inactive'}`}
                accessibilityState={{ expanded }}
              >
                <View style={rowStyle('default')}>
                  <View style={[consoleStyles.surfaceIcon, { backgroundColor: tokens.surfaceRaised }]}>
                    <Icon name="globe" size={20} color={tokens.accentSoft} />
                  </View>
                  <View style={rowStyles.text}>
                    <Text style={rowStyles.title}>{group.appName}</Text>
                    <Text style={rowStyles.detail}>
                      {group.appKind} · {group.grants.length} {group.grants.length === 1 ? 'grant' : 'grants'} · Last used {group.lastUsed}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <StatusPill
                        label={group.activeCount > 0 ? 'Active' : 'Inactive'}
                        tone={group.activeCount > 0 ? 'success' : 'neutral'}
                      />
                      <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                        <Icon name="chevronRight" size={14} color={tokens.muted} />
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
              {expanded
                ? group.grants.map((grant) => (
                    <GrantCard key={grant.id} grant={grant} onRevoke={onRevokeGrant} />
                  ))
                : null}
            </View>
          )
        })
      ) : grants.length > 0 ? (
        <Text style={{ color: tokens.muted, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
          No matches
        </Text>
      ) : (
        <EmptyCard
          icon="globe"
          title="No connected apps"
          body="Apps you approve will appear here with their grants."
        />
      )}
    </View>
  )
}
