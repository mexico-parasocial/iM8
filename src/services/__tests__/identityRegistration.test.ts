import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hexToBytes } from '@noble/curves/abstract/utils'
import {
  registerIdentityWith,
  REGISTRABLE_LABELS,
  REGISTRATION_AUDIENCE,
  type RegistrationDeps,
} from '../identityRegistration'
import {
  signIdentityChallenge,
  verifyIdentityAssertion,
  type SignedAssertion,
} from '../identitySignature'

// A fixed 32-byte seed; the flow is deterministic apart from the signature nonce.
const SEED = hexToBytes(
  '150fa3a728c08094f419910d77367ff90c1b7c694039718431638aa4033a2a73',
)

// The production signer signs with the seedVault key; here we sign directly with
// the same primitive over a raw seed, which is exactly what seedVault does.
const signWith =
  (label: 'public' | 'anonymous') =>
  async (input: { purpose: 'mubez-registration'; audience: string; challenge: string }) =>
    signIdentityChallenge(SEED, label, input)

/**
 * A fake broker: issues a challenge on the first call and, on the second,
 * verifies the posted proof with the REAL verifier before answering. This is
 * the server contract in miniature — if the client posts an assertion the
 * server would reject, this fake rejects it too.
 */
function fakeBroker(opts: { alreadyRegistered?: boolean } = {}) {
  const calls: { path: string; body: unknown }[] = []
  let issuedChallenge = ''
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })

    if (path.endsWith('/identity/register/challenge')) {
      issuedChallenge = 'challenge-' + Math.random().toString(36).slice(2)
      return json({ challenge: issuedChallenge })
    }
    if (path.endsWith('/identity/register')) {
      const signed = (body as { signed: SignedAssertion }).signed
      const ok = verifyIdentityAssertion(signed, {
        purpose: 'mubez-registration',
        audience: REGISTRATION_AUDIENCE,
        challenge: issuedChallenge,
      })
      if (!ok) return json({ error: 'Registration rejected' }, 401)
      return json(
        { registered: true, alreadyRegistered: !!opts.alreadyRegistered },
        opts.alreadyRegistered ? 200 : 201,
      )
    }
    return json({ error: 'not found' }, 404)
  }) as unknown as typeof fetch

  const deps: RegistrationDeps = { baseUrl: 'https://broker.test/v1', fetchFn }
  return { deps, calls, getChallenge: () => issuedChallenge }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('identity registration flow (F2b client)', () => {
  it('never offers the ballot identity for registration', () => {
    assert.deepEqual([...REGISTRABLE_LABELS], ['public', 'anonymous'])
    assert.ok(!REGISTRABLE_LABELS.includes('civic' as never))
  })

  it('fetches a challenge, signs it, and posts a verifiable proof', async () => {
    const broker = fakeBroker()
    const result = await registerIdentityWith(broker.deps, signWith('anonymous'))
    assert.deepEqual(result, { registered: true, alreadyRegistered: false })

    // Two calls, in order: challenge then register.
    assert.equal(broker.calls.length, 2)
    assert.ok(broker.calls[0].path.endsWith('/identity/register/challenge'))
    assert.ok(broker.calls[1].path.endsWith('/identity/register'))

    // The posted assertion is bound to the exact challenge the server issued,
    // for the registration purpose and audience — the fake verified it, but pin
    // the binding explicitly so a regression is legible.
    const posted = (broker.calls[1].body as { signed: SignedAssertion }).signed
    assert.equal(posted.assertion.purpose, 'mubez-registration')
    assert.equal(posted.assertion.audience, REGISTRATION_AUDIENCE)
    assert.equal(posted.assertion.challenge, broker.getChallenge())
  })

  it('reports an already-registered key as such', async () => {
    const broker = fakeBroker({ alreadyRegistered: true })
    const result = await registerIdentityWith(broker.deps, signWith('public'))
    assert.deepEqual(result, { registered: true, alreadyRegistered: true })
  })

  it('throws when the broker rejects the proof', async () => {
    const broker = fakeBroker()
    // A signer that signs for the wrong audience: the fake verifier rejects it.
    const badSigner = async (input: {
      purpose: 'mubez-registration'
      audience: string
      challenge: string
    }) => signIdentityChallenge(SEED, 'anonymous', { ...input, audience: 'para-idp' })
    await assert.rejects(
      registerIdentityWith(broker.deps, badSigner),
      /registration failed/i,
    )
  })

  it('signs over the server-issued challenge, not a client-chosen one', async () => {
    const broker = fakeBroker()
    let sawChallenge = ''
    await registerIdentityWith(broker.deps, async (input) => {
      sawChallenge = input.challenge
      return signIdentityChallenge(SEED, 'anonymous', input)
    })
    assert.equal(sawChallenge, broker.getChallenge())
    assert.ok(sawChallenge.startsWith('challenge-'))
  })
})
