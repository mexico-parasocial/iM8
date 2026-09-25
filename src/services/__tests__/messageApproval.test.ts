import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  approvalCodeFor,
  approveMessage,
  buildMessageChallenge,
  hashMessageBody,
  verifyMessageApproval,
} from '../messageApproval'

// Fixed test key material: NOT a real seed (see keyDerivation tests).
const SEED = new Uint8Array(32).fill(11)
const RANDOM = new Uint8Array(32).fill(7)

const MESSAGE = {
  roomId: '!DqFIEFMDqZJUCeOVBb:matrix.para.social',
  body: 'hello bob, baseline from curl',
  sentAt: '2026-09-06T12:00:00.000Z',
}

describe('buildMessageChallenge', () => {
  it('commits to room, body hash and timestamp in fixed order', () => {
    const challenge = buildMessageChallenge(MESSAGE)
    assert.ok(challenge.startsWith('para-id/message/v1\n'))
    assert.ok(challenge.includes(`room:${MESSAGE.roomId}`))
    assert.ok(challenge.includes(`body:${hashMessageBody(MESSAGE.body)}`))
    assert.ok(challenge.includes(`at:${MESSAGE.sentAt}`))
  })

  it('hashes the body so long messages stay fixed-size', () => {
    assert.equal(hashMessageBody(MESSAGE.body).length, 64)
    assert.notEqual(
      hashMessageBody(MESSAGE.body),
      hashMessageBody(MESSAGE.body + '!'),
    )
  })

  it('refuses empty fields instead of signing an open challenge', () => {
    assert.throws(() => buildMessageChallenge({ ...MESSAGE, roomId: '' }), /roomId/)
    assert.throws(() => buildMessageChallenge({ ...MESSAGE, body: '' }), /body/)
    assert.throws(() => buildMessageChallenge({ ...MESSAGE, sentAt: '' }), /sentAt/)
  })
})

describe('approveMessage', () => {
  it('approves under the message-approve purpose with a 6-digit code', () => {
    const approval = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    assert.equal(approval.assertion.purpose, 'message-approve')
    assert.equal(approval.assertion.audience, 'matrix')
    assert.equal(approval.assertion.challenge, buildMessageChallenge(MESSAGE))
    assert.match(approval.code, /^\d{6}$/)
    assert.equal(approval.code, approvalCodeFor(approval.signature))
  })

  it('gives every message its own code', () => {
    const first = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    const second = approveMessage(
      SEED,
      'public',
      { ...MESSAGE, body: 'different body' },
      RANDOM,
    )
    assert.notEqual(first.code, second.code)
  })

  it('refuses civic and other non-messenger identities', () => {
    assert.throws(
      () => approveMessage(SEED, 'civic' as never, MESSAGE, RANDOM),
      /must not have a Matrix account|forbidden/i,
    )
  })
})

describe('verifyMessageApproval', () => {
  it('accepts the exact message it approved', () => {
    const approval = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    assert.equal(
      verifyMessageApproval(approval, { ...MESSAGE, audience: 'matrix' }),
      true,
    )
  })

  it('rejects an edited body, a moved room, and a wrong audience', () => {
    const approval = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    assert.equal(
      verifyMessageApproval(approval, {
        ...MESSAGE,
        body: MESSAGE.body + ' (edited)',
        audience: 'matrix',
      }),
      false,
    )
    assert.equal(
      verifyMessageApproval(approval, {
        ...MESSAGE,
        roomId: '!other:matrix.para.social',
        audience: 'matrix',
      }),
      false,
    )
    assert.equal(
      verifyMessageApproval(approval, { ...MESSAGE, audience: 'para-idp' }),
      false,
    )
  })

  it('rejects a login assertion presented as an approval', () => {
    // A matrix-login assertion for the same challenge must not approve:
    // purpose binding is the whole point of the separate purpose.
    const approval = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    const forged = {
      ...approval,
      assertion: { ...approval.assertion, purpose: 'matrix-login' as const },
    }
    assert.equal(
      verifyMessageApproval(forged, { ...MESSAGE, audience: 'matrix' }),
      false,
    )
  })

  it('rejects garbage instead of throwing', () => {
    assert.equal(
      verifyMessageApproval({} as never, { ...MESSAGE, audience: 'matrix' }),
      false,
    )
    assert.equal(
      verifyMessageApproval(
        { assertion: null, signature: 'nope' } as never,
        { ...MESSAGE, audience: 'matrix' },
      ),
      false,
    )
  })
})
