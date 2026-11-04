import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  filterAppGroups,
  groupGrantsByApp,
  sortAppGroups,
} from '../appDirectory'
import type { AppGrant } from '../../types'

function grant(overrides: Partial<AppGrant> & { id: string }): AppGrant {
  return {
    appId: 'atmos-dating',
    appName: 'Atmos Dating beta',
    appKind: 'Consumer app',
    surface: 'public',
    signals: [],
    requestedClaims: [],
    shareMode: 'proof-only',
    state: 'Live',
    status: 'Active',
    grantedAt: 'Today',
    lastUsed: '2 hours ago',
    expiresAt: '30 days',
    audience: 'Matchmaking',
    reason: 'Proofs only.',
    verifier: 'PARA verifier',
    issuerRecord: 'com.para.identity',
    compatibilityRecord: 'app.bsky.graph.verification',
    proofArtifactIds: [],
    ...overrides,
  }
}

describe('groupGrantsByApp', () => {
  it('groups by app id and counts active grants', () => {
    const groups = groupGrantsByApp([
      grant({ id: 'g1' }),
      grant({ id: 'g2', status: 'Revoked', state: 'Paused' }),
      grant({ id: 'g3', appId: 'wallet', appName: 'Neighborhood wallet' }),
    ])
    assert.equal(groups.length, 2)
    assert.equal(groups[0].grants.length, 2)
    assert.equal(groups[0].activeCount, 1)
    assert.equal(groups[1].appId, 'wallet')
  })

  it('takes recency from the newest grant in the group', () => {
    const groups = groupGrantsByApp([
      grant({ id: 'g1', lastUsed: 'Yesterday', lastUsedAt: '2026-09-05T10:00:00.000Z' }),
      grant({ id: 'g2', lastUsed: 'Today', lastUsedAt: '2026-09-06T10:00:00.000Z' }),
    ])
    assert.equal(groups[0].lastUsed, 'Today')
    assert.equal(groups[0].lastUsedAt, '2026-09-06T10:00:00.000Z')
  })
})

describe('sortAppGroups', () => {
  it('orders most recently used first', () => {
    const groups = groupGrantsByApp([
      grant({ id: 'g1', lastUsed: 'Yesterday', lastUsedAt: '2026-09-05T10:00:00.000Z' }),
      grant({ id: 'g2', appId: 'b', appName: 'B', lastUsed: 'Today', lastUsedAt: '2026-09-06T10:00:00.000Z' }),
    ])
    const sorted = sortAppGroups(groups)
    assert.equal(sorted[0].appId, 'b')
  })

  it('keeps untimestamped apps stable after the timestamped ones', () => {
    const groups = groupGrantsByApp([
      grant({ id: 'g1', appId: 'plain', appName: 'Plain', lastUsedAt: undefined }),
      grant({ id: 'g2', appId: 'fresh', appName: 'Fresh', lastUsedAt: '2026-09-06T10:00:00.000Z' }),
      grant({ id: 'g3', appId: 'older-plain', appName: 'Older plain', lastUsedAt: undefined }),
    ])
    const sorted = sortAppGroups(groups)
    assert.deepEqual(
      sorted.map((group) => group.appId),
      ['fresh', 'plain', 'older-plain'],
    )
  })
})

describe('filterAppGroups', () => {
  it('matches name, id and kind case-insensitively', () => {
    const groups = groupGrantsByApp([
      grant({ id: 'g1' }),
      grant({ id: 'g2', appId: 'wallet', appName: 'Neighborhood wallet', appKind: 'Local app' }),
    ])
    assert.equal(filterAppGroups(groups, '').length, 2)
    assert.equal(filterAppGroups(groups, 'dating')[0].appId, 'atmos-dating')
    assert.equal(filterAppGroups(groups, 'LOCAL')[0].appId, 'wallet')
    assert.deepEqual(filterAppGroups(groups, 'nope'), [])
  })
})
