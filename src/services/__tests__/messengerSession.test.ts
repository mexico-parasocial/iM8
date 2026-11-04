import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  activateMessengerSession,
  assertMessengerAction,
  assertSendApproval,
  createMessengerSession,
  enterMessengerCode,
  isMessengerActionAllowed,
  isValidMessengerCode,
  lockMessengerSession,
  MessengerCodeError,
  MessengerStateError,
} from '../messengerSession'
import { approveMessage } from '../messageApproval'

const AT = '2026-09-06T12:00:00.000Z'
const SEED = new Uint8Array(32).fill(11)
const RANDOM = new Uint8Array(32).fill(7)
const MESSAGE = {
  roomId: '!room:matrix.para.social',
  body: 'approved hello',
  sentAt: AT,
  audience: 'matrix',
}

function activeSession() {
  return activateMessengerSession(
    enterMessengerCode(createMessengerSession(), '482913', AT),
    'device-1',
    AT,
  )
}

describe('messenger code entry', () => {
  it('accepts six digits and rejects everything else', () => {
    assert.equal(isValidMessengerCode('482913'), true)
    assert.equal(isValidMessengerCode(' 482913 '), true)
    assert.equal(isValidMessengerCode('48291'), false)
    assert.equal(isValidMessengerCode('4829134'), false)
    assert.equal(isValidMessengerCode('abcdef'), false)
    assert.equal(isValidMessengerCode(''), false)
  })

  it('enters code-entered from idle and refuses a second code', () => {
    const entered = enterMessengerCode(createMessengerSession(), '482913', AT)
    assert.equal(entered.state, 'code-entered')
    assert.equal(entered.enteredAt, AT)
    assert.throws(
      () => enterMessengerCode(entered, '123456', AT),
      MessengerStateError,
    )
  })

  it('refuses malformed codes without changing state', () => {
    assert.throws(
      () => enterMessengerCode(createMessengerSession(), 'nope', AT),
      MessengerCodeError,
    )
  })

  it('re-entry is allowed from locked (a fresh code, not a resume)', () => {
    const locked = lockMessengerSession(activeSession())
    assert.equal(locked.state, 'locked')
    const reentered = enterMessengerCode(locked, '123456', AT)
    assert.equal(reentered.state, 'code-entered')
    assert.equal(reentered.deviceId, undefined)
  })
})

describe('activation', () => {
  it('activates from code-entered with a device id', () => {
    const session = activeSession()
    assert.equal(session.state, 'active')
    assert.equal(session.deviceId, 'device-1')
  })

  it('refuses activation without a code and without a device', () => {
    assert.throws(
      () => activateMessengerSession(createMessengerSession(), 'device-1', AT),
      /enter a code first/,
    )
    assert.throws(
      () =>
        activateMessengerSession(
          enterMessengerCode(createMessengerSession(), '482913', AT),
          '',
          AT,
        ),
      /deviceId/,
    )
  })
})

describe('action allowlist', () => {
  it('allows messaging and membership, nothing else', () => {
    for (const action of [
      'message.send',
      'message.read',
      'room.create',
      'room.join',
      'room.leave',
      'sync',
    ]) {
      assert.equal(isMessengerActionAllowed(action), true)
    }
    for (const action of [
      'profile.set',
      'profile.read',
      'account.deactivate',
      'device.list',
      'device.delete',
      'admin.ban',
      '',
    ]) {
      assert.equal(isMessengerActionAllowed(action), false)
    }
  })

  it('refuses everything while not active, even allowlisted actions', () => {
    for (const session of [
      createMessengerSession(),
      enterMessengerCode(createMessengerSession(), '482913', AT),
      lockMessengerSession(activeSession()),
    ]) {
      assert.throws(
        () => assertMessengerAction(session, 'message.send'),
        MessengerStateError,
      )
    }
  })

  it('refuses identity actions while active: no state permits them', () => {
    const session = activeSession()
    assertMessengerAction(session, 'message.send')
    assert.throws(
      () => assertMessengerAction(session, 'profile.set'),
      /never allow/,
    )
    assert.throws(
      () => assertMessengerAction(session, 'device.delete'),
      /never allow/,
    )
  })
})

describe('send approval gate', () => {
  it('passes a matching approval and code', () => {
    const approval = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    assertSendApproval(approval, { ...MESSAGE, code: approval.code })
  })

  it('refuses a code that does not match the confirm sheet', () => {
    const approval = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    assert.throws(
      () =>
        assertSendApproval(approval, { ...MESSAGE, code: '000000' }),
      /does not match/,
    )
  })

  it('refuses an approval moved to another message', () => {
    const approval = approveMessage(SEED, 'public', MESSAGE, RANDOM)
    assert.throws(
      () =>
        assertSendApproval(approval, {
          ...MESSAGE,
          body: 'different body',
          code: approval.code,
        }),
      /does not verify/,
    )
  })

  it('refuses malformed approvals instead of throwing elsewhere', () => {
    assert.throws(
      () =>
        assertSendApproval({} as never, {
          ...MESSAGE,
          code: '000000',
        }),
      MessengerStateError,
    )
  })
})
