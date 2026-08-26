import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveIdentity,
  deriveMasterKeys,
  IDENTITY_INDEXES,
  type IdentityLabel,
} from '../keyDerivation'

const seed = new Uint8Array(32).fill(7)
const keys = deriveMasterKeys(seed)
const labels = Object.keys(IDENTITY_INDEXES) as IdentityLabel[]

describe('per-card derivation', () => {
  it('leaves card 0 byte-identical to spec v1', () => {
    // The shared mubEZ vectors cover card 0; this pins that the default
    // argument is what those vectors exercise.
    for (const label of labels) {
      assert.equal(
        deriveIdentity(keys, label, 0).pubHex,
        deriveIdentity(keys, label).pubHex,
      )
    }
  })

  it('gives each card of a label its own key', () => {
    // The product promise: two anonymous cards are not linked. That has to
    // hold cryptographically, not just in the UI copy.
    const seen = new Set<string>()
    for (let card = 0; card < 8; card++) {
      const { pubHex } = deriveIdentity(keys, 'anonymous', card)
      assert.ok(!seen.has(pubHex), `card ${card} collided with an earlier card`)
      seen.add(pubHex)
    }
  })

  it('keeps cards distinct across labels too', () => {
    const seen = new Set<string>()
    for (const label of labels) {
      for (let card = 0; card < 4; card++) {
        const { pubHex } = deriveIdentity(keys, label, card)
        assert.ok(!seen.has(pubHex), `${label}/${card} collided`)
        seen.add(pubHex)
      }
    }
  })

  it('is deterministic for the same seed, label and card', () => {
    const again = deriveMasterKeys(seed)
    assert.equal(
      deriveIdentity(keys, 'anonymous', 3).pubHex,
      deriveIdentity(again, 'anonymous', 3).pubHex,
    )
  })

  it('gives different seeds different cards', () => {
    const other = deriveMasterKeys(new Uint8Array(32).fill(9))
    assert.notEqual(
      deriveIdentity(keys, 'anonymous', 3).pubHex,
      deriveIdentity(other, 'anonymous', 3).pubHex,
    )
  })

  it('reports the card it derived', () => {
    assert.equal(deriveIdentity(keys, 'anonymous', 5).card, 5)
    assert.equal(deriveIdentity(keys, 'anonymous').card, 0)
  })

  it('rejects a nonsense card index', () => {
    assert.throws(() => deriveIdentity(keys, 'anonymous', -1))
    assert.throws(() => deriveIdentity(keys, 'anonymous', 1.5))
  })
})
