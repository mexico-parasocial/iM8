import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { PERSONA_IDENTITY, identityForPersonaKind, personaKeyRef } from '../personaIdentity'
import { IDENTITY_INDEXES, deriveIdentity, deriveMasterKeys } from '../keyDerivation'
import type { PersonaKind } from '../../types'

describe('persona → identity mapping', () => {
  it('gives every persona kind its own label', () => {
    const labels = Object.values(PERSONA_IDENTITY)
    assert.equal(new Set(labels).size, labels.length,
      'two persona kinds share a key — they would be correlatable')
  })

  it('only points at labels the derivation spec defines', () => {
    for (const label of Object.values(PERSONA_IDENTITY)) {
      assert.ok(label in IDENTITY_INDEXES)
    }
  })

  it('never fronts a persona with the civic root', () => {
    // The root enforces one-person-one-vote. If it also signed a visible card,
    // every post from that card would tie back to the vote.
    assert.ok(!Object.values(PERSONA_IDENTITY).includes('civic'))
  })

  it('resolves both persona kinds', () => {
    assert.equal(identityForPersonaKind('public' as PersonaKind), 'public')
    assert.equal(identityForPersonaKind('anonymous' as PersonaKind), 'anonymous')
  })

  it('defaults to the primary card', () => {
    assert.deepEqual(personaKeyRef('anonymous' as PersonaKind),
      { label: 'anonymous', card: 0 })
  })

  it('produces genuinely distinct keys for two anonymous cards', () => {
    const keys = deriveMasterKeys(new Uint8Array(32).fill(3))
    const first = personaKeyRef('anonymous' as PersonaKind, 0)
    const second = personaKeyRef('anonymous' as PersonaKind, 1)
    assert.notEqual(
      deriveIdentity(keys, first.label, first.card).pubHex,
      deriveIdentity(keys, second.label, second.card).pubHex,
    )
  })

  it('rejects a nonsense card index', () => {
    assert.throws(() => personaKeyRef('anonymous' as PersonaKind, -1))
  })
})
