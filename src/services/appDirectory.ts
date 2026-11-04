import type { AppGrant } from '../types'

/**
 * Apps directory: grants grouped by app, most recently used first.
 *
 * Borrowed from the Bluesky oauth-provider-ui Apps page (bluesky-social/
 * atproto#5482): the app is named by its friendly name, the list is sorted
 * by recency, and it filters by free text. The grant rows themselves stay
 * where they are — this is the directory on top, not a replacement.
 *
 * Pure logic, no native imports: testable under `tsx --test`.
 */

export type AppGroup = {
  appId: string
  appName: string
  appKind: string
  grants: AppGrant[]
  activeCount: number
  /** Display string of the most recent grant; 'Unknown' when untimestamped. */
  lastUsed: string
  /** Machine timestamp behind `lastUsed`, when any grant carries one. */
  lastUsedAt: string | null
}

/** Group grants by `appId`, preserving first-seen app order. */
export function groupGrantsByApp(grants: AppGrant[]): AppGroup[] {
  const groups = new Map<string, AppGroup>()
  for (const grant of grants) {
    const existing = groups.get(grant.appId)
    if (existing) {
      existing.grants.push(grant)
      if (grant.status === 'Active') existing.activeCount += 1
      const ranked = rankTimestamp(grant.lastUsedAt)
      const current = rankTimestamp(existing.lastUsedAt)
      if (ranked > current) {
        existing.lastUsed = grant.lastUsed
        existing.lastUsedAt = grant.lastUsedAt ?? null
      }
    } else {
      groups.set(grant.appId, {
        appId: grant.appId,
        appName: grant.appName,
        appKind: grant.appKind,
        grants: [grant],
        activeCount: grant.status === 'Active' ? 1 : 0,
        lastUsed: grant.lastUsed,
        lastUsedAt: grant.lastUsedAt ?? null,
      })
    }
  }
  return [...groups.values()]
}

function rankTimestamp(iso: string | null | undefined): number {
  if (!iso) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

/**
 * Most recently used first. Apps without a machine timestamp keep their
 * relative order after the timestamped ones — they must not jump around
 * as grants come and go.
 */
export function sortAppGroups(groups: AppGroup[]): AppGroup[] {
  return [...groups]
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const ra = rankTimestamp(a.group.lastUsedAt)
      const rb = rankTimestamp(b.group.lastUsedAt)
      const aFinite = Number.isFinite(ra)
      const bFinite = Number.isFinite(rb)
      if (aFinite && bFinite && ra !== rb) return rb - ra
      if (aFinite && !bFinite) return -1
      if (!aFinite && bFinite) return 1
      return a.index - b.index
    })
    .map(({ group }) => group)
}

/** Free-text filter over name, id and kind. */
export function filterAppGroups(groups: AppGroup[], query: string): AppGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  return groups.filter((group) =>
    [group.appName, group.appId, group.appKind].some((field) =>
      field.toLowerCase().includes(q),
    ),
  )
}
