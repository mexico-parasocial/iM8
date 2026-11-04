import type { SignedAssertion } from './identitySignature'

/*
 * Identity registration flow (mubEZ CD-9), pure of react-native and custody.
 *
 * The client registers an identity by its public key plus a proof of
 * possession, so the server can verify the key later without any table linking
 * it to a session. This module holds only the flow — fetch a challenge, sign
 * it, post the proof — with the base URL, the fetch implementation, and the
 * signer all injected. That keeps it importable in a plain Node test (brokerApi
 * pulls in react-native globals and cannot be) and keeps seed custody in
 * seedVault. See `brokerApi.ts` for the production wiring.
 */

export const REGISTRATION_AUDIENCE =
  process.env.EXPO_PUBLIC_M8_REGISTRATION_AUDIENCE?.trim() || 'mubez'

/**
 * The identities that may be registered — the two signable ones. `civic` (the
 * ballot identity) is excluded by OD-7 Reading A and refused by the signer.
 */
export const REGISTRABLE_LABELS = ['public', 'anonymous'] as const
export type RegistrableLabel = (typeof REGISTRABLE_LABELS)[number]

/**
 * A signer over a registration challenge. Injected so the flow can be tested
 * without the secure store and so custody stays in seedVault in production.
 */
export type RegistrationSigner = (input: {
  purpose: 'mubez-registration'
  audience: string
  challenge: string
}) => Promise<SignedAssertion>

export type RegistrationDeps = {
  /** Broker base URL, already including the version prefix (e.g. .../v1). */
  baseUrl: string
  /** The fetch implementation to use. */
  fetchFn: typeof fetch
}

export type RegistrationResult = { registered: boolean; alreadyRegistered: boolean }

async function registrationFetch<T>(
  deps: RegistrationDeps,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await deps.fetchFn(`${deps.baseUrl}${path}`, {
    method: 'POST',
    // No Authorization header on purpose: registration is session-unbound.
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : null
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object'
        ? ((payload as { error?: string }).error ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`
    throw new Error(`identity registration failed: ${message}`)
  }
  return payload as T
}

/**
 * The registration flow with everything injected: fetch a fresh single-use
 * challenge, sign it under `mubez-registration`, post the proof.
 */
export async function registerIdentityWith(
  deps: RegistrationDeps,
  sign: RegistrationSigner,
): Promise<RegistrationResult> {
  const { challenge } = await registrationFetch<{ challenge: string }>(
    deps,
    '/identity/register/challenge',
  )
  const signed = await sign({
    purpose: 'mubez-registration',
    audience: REGISTRATION_AUDIENCE,
    challenge,
  })
  return registrationFetch<RegistrationResult>(deps, '/identity/register', {
    signed,
  })
}

/*
 * Per-mutation proof of possession (CD-10). The broker audience the anon-action
 * proof is bound to; must equal the server's M8_BROKER_AUDIENCE.
 */
export const BROKER_AUDIENCE =
  process.env.EXPO_PUBLIC_M8_BROKER_AUDIENCE?.trim() || 'mubez'

export type ActionSigner = (input: {
  purpose: 'anon-action'
  audience: string
  challenge: string
}) => Promise<SignedAssertion>

/**
 * Build a per-request proof for an anonymous-surface mutation: fetch a
 * single-use challenge bound to (identityPub, action), sign it under
 * `anon-action`, and pair it with a client one-time id. The server verifies the
 * signature and consumes the challenge+jti atomically. `jti` is injected so this
 * stays pure (brokerApi supplies the randomness).
 */
export async function buildActionProof(
  deps: RegistrationDeps,
  sign: ActionSigner,
  opts: { identityPub: string; action: string; jti: string },
): Promise<{ signed: SignedAssertion; jti: string }> {
  const { challenge } = await registrationFetch<{ challenge: string }>(
    deps,
    '/identity/action-challenge',
    { identityPub: opts.identityPub, action: opts.action },
  )
  const signed = await sign({
    purpose: 'anon-action',
    audience: BROKER_AUDIENCE,
    challenge,
  })
  return { signed, jti: opts.jti }
}
