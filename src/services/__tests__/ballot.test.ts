import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  assertOpaqueBallotRecord,
  BallotLinkageError,
  buildBallotDelegation,
  buildBallotVote,
  findPersonaLeakage,
  personaIdentifiers,
} from '../ballot'
import {
  buildPersonas,
  buildPublicPersona,
  buildSurfaceTemplates,
} from '../../poc-data'

const AT = '2026-09-06T12:00:00.000Z'

/**
 * The guarantee, in one place: whichever card the user is acting as —
 * public, alt, or anonymous — delegating or voting emits the identical
 * opaque transaction, carrying none of that card's identifiers.
 *
 * These three personas stand in for the header's card switcher. The
 * builders take no persona at all, so the switch cannot leak through a
 * parameter; these tests pin that the output is identical and clean.
 */
function actingAsPersonas() {
  const personas = buildPersonas('voter.m8.local')
  const publicPersona = buildPublicPersona('voter-public', ['bsky'])
  return { personas, publicPersona }
}

describe('opaque across identities', () => {
  it('a vote is identical and clean acting as public, alt, or anonymous', () => {
    const { personas, publicPersona } = actingAsPersonas()
    const cards = [publicPersona, ...personas]
    const votes = cards.map(() =>
      buildBallotVote({
        subject: 'at://did:plc:policy/123',
        subjectType: 'policy',
        signal: 2,
        isDirect: true,
        voteNullifier: 'nullifier-abc',
        eligibilityProofRef: 'proof-ref-abc',
        createdAt: AT,
      }),
    )
    for (const vote of votes) {
      assertOpaqueBallotRecord(vote, personaIdentifiers(cards))
    }
    for (const vote of votes.slice(1)) {
      assert.deepEqual(vote, votes[0])
    }
  })

  it('a delegation is identical and clean acting as public, alt, or anonymous', () => {
    const { personas, publicPersona } = actingAsPersonas()
    const cards = [publicPersona, ...personas]
    const delegations = cards.map(() =>
      buildBallotDelegation({
        delegateTo: 'did:plc:delegate-01',
        mode: 'active',
        createdAt: AT,
      }),
    )
    for (const delegation of delegations) {
      assertOpaqueBallotRecord(delegation, personaIdentifiers(cards))
    }
    for (const delegation of delegations.slice(1)) {
      assert.deepEqual(delegation, delegations[0])
    }
  })

  it('pins the record shapes so no linkage field can sneak in later', () => {
    const vote = buildBallotVote({
      subject: 'at://did:plc:policy/123',
      signal: 1,
      isDirect: true,
      createdAt: AT,
    })
    assert.deepEqual(Object.keys(vote).sort(), [
      '$type',
      'createdAt',
      'isDirect',
      'signal',
      'subject',
    ])
    const delegation = buildBallotDelegation({
      delegateTo: 'did:plc:delegate-01',
      createdAt: AT,
    })
    assert.deepEqual(Object.keys(delegation).sort(), [
      '$type',
      'createdAt',
      'delegateTo',
    ])
  })
})

describe('linkage validator', () => {
  it('rejects voter-naming keys at any depth', () => {
    assert.throws(
      () =>
        assertOpaqueBallotRecord(
          { subject: 'x', personaId: 'anon-primary' },
          [],
        ),
      BallotLinkageError,
    )
    assert.throws(
      () =>
        assertOpaqueBallotRecord(
          { subject: 'x', nested: { voter: { mxid: '@a:b' } } },
          [],
        ),
      (error: unknown) => {
        assert.ok(error instanceof BallotLinkageError)
        assert.deepEqual(error.paths, ['$.nested.voter', '$.nested.voter.mxid'])
        return true
      },
    )
  })

  it('rejects exact persona identifier values but not ordinary prose', () => {
    const ids = ['@voter.m8.local', 'voter-public']
    assert.deepEqual(
      findPersonaLeakage({ note: 'a public statement' }, ids),
      [],
    )
    assert.deepEqual(
      findPersonaLeakage({ note: '@voter.m8.local' }, ids),
      ['$.note'],
    )
    assert.deepEqual(
      findPersonaLeakage({ list: ['ok', 'voter-public'] }, ids),
      ['$.list[1]'],
    )
  })

  it('accepts delegate targets alongside voter identifiers', () => {
    // The delegate DID is the user's explicit choice, not their identity —
    // so it is not among the voter identifiers, and the record stays clean.
    const { personas, publicPersona } = actingAsPersonas()
    const delegation = buildBallotDelegation({
      delegateTo: 'did:plc:delegate-01',
      createdAt: AT,
    })
    assertOpaqueBallotRecord(
      delegation,
      personaIdentifiers([publicPersona, ...personas]),
    )
  })
})

describe('lexicon validation', () => {
  it('bounds signals, options, modes and lengths', () => {
    assert.throws(
      () =>
        buildBallotVote({
          subject: 'at://x/1',
          signal: 4,
          isDirect: true,
          createdAt: AT,
        }),
      /signal/,
    )
    assert.throws(
      () =>
        buildBallotDelegation({
          delegateTo: 'not-a-did',
          createdAt: AT,
        }),
      /DID/,
    )
    assert.throws(
      () =>
        buildBallotDelegation({
          delegateTo: 'did:plc:delegate-01',
          mode: 'sometimes' as never,
          createdAt: AT,
        }),
      /mode/,
    )
    assert.throws(
      () =>
        buildBallotVote({
          subject: '',
          isDirect: true,
          createdAt: AT,
        }),
      /subject/,
    )
    assert.throws(
      () =>
        buildBallotVote({
          subject: 'at://x/1',
          isDirect: true,
          createdAt: 'not-a-date',
        }),
      /createdAt/,
    )
  })
})

describe('delegation on by default, anonymous by default', () => {
  it('no surface gates delegation behind a trait', () => {
    for (const template of buildSurfaceTemplates()) {
      assert.ok(
        template.traits.every((trait) => !trait.includes('delegat')),
        `${template.id} carries a delegation trait`,
      )
    }
  })

  it('every voting or delegation signal defaults to Private on every card', () => {
    const personas = [
      ...buildPersonas('voter.m8.local'),
      buildPublicPersona('voter-public', ['bsky']),
    ]
    const watched = personas.flatMap((persona) =>
      persona.signals
        .filter((signal) => /vot|delegat/i.test(signal.label))
        .map((signal) => `${persona.id}:${signal.label}`),
    )
    assert.ok(watched.length > 0, 'expected at least one voting signal to audit')
    for (const persona of personas) {
      for (const signal of persona.signals) {
        if (/vot|delegat/i.test(signal.label)) {
          assert.equal(
            signal.visibility,
            'Private',
            `${persona.id}:${signal.label} is ${signal.visibility}`,
          )
        }
      }
    }
  })
})
