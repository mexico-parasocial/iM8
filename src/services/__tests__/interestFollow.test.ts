import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  countFollowedInterests,
  toggleInterestFollowed,
  totalFollowedInterests,
} from '../interestFollow'

describe('toggleInterestFollowed', () => {
  it('follows an interest in an empty map', () => {
    assert.deepEqual(toggleInterestFollowed({}, 'economy', 'Inflation'), {
      economy: ['Inflation'],
    })
  })

  it('unfollows on the second toggle', () => {
    const followed = toggleInterestFollowed({}, 'economy', 'Inflation')
    assert.deepEqual(toggleInterestFollowed(followed, 'economy', 'Inflation'), {
      economy: [],
    })
  })

  it('keeps categories isolated and never mutates the input', () => {
    const before = { economy: ['Inflation'] }
    const next = toggleInterestFollowed(before, 'economy', 'Employment')
    assert.deepEqual(next, { economy: ['Inflation', 'Employment'] })
    assert.deepEqual(before, { economy: ['Inflation'] })
    const other = toggleInterestFollowed(next, 'social-issues', 'Housing')
    assert.deepEqual(other['economy'], ['Inflation', 'Employment'])
    assert.deepEqual(other['social-issues'], ['Housing'])
  })
})

describe('interest counts', () => {
  it('counts per category and in total', () => {
    const followed = {
      economy: ['Inflation', 'Employment'],
      'social-issues': ['Housing'],
    }
    assert.deepEqual(countFollowedInterests(followed, 'economy', 5), {
      active: 2,
      total: 5,
    })
    assert.deepEqual(countFollowedInterests(followed, 'internal-affairs', 5), {
      active: 0,
      total: 5,
    })
    assert.equal(totalFollowedInterests(followed), 3)
    assert.equal(totalFollowedInterests({}), 0)
  })
})
