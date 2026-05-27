import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createProofBrokerServer } from '../src/http.ts'
import { ProofBrokerStore } from '../src/store.ts'

type JsonObject = Record<string, unknown>

async function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'm8-broker-'))
  const store = new ProofBrokerStore(join(tempDir, 'broker.sqlite'))
  const server = createProofBrokerServer(store)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Broker test server did not expose a TCP address')
  }

  const baseUrl = `http://127.0.0.1:${address.port}`

  async function request(path: string, init: RequestInit = {}, sessionId?: string | null) {
    const headers = new Headers(init.headers)
    headers.set('content-type', 'application/json')
    if (sessionId) {
      headers.set('x-m8-session-id', sessionId)
      headers.set('authorization', `Bearer ${sessionId}`)
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    })
    const text = await response.text()
    const body = text ? (JSON.parse(text) as JsonObject) : {}
    const nextSessionId = response.headers.get('x-m8-session-id') ?? sessionId ?? null
    return { body, response, sessionId: nextSessionId }
  }

  function close() {
    return new Promise<void>((resolve, reject) => {
      server.close((error) => {
        rmSync(tempDir, { recursive: true, force: true })
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  return { close, request }
}

async function startSession(
  request: Awaited<ReturnType<typeof createHarness>>['request'],
  identifier: string
) {
  const result = await request('/session/start', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  })

  assert.equal(result.response.status, 200)
  assert.ok(result.sessionId)
  return result
}

test('normalizes handle, DID, and service URL identifiers into broker sessions', async () => {
  const harness = await createHarness()

  try {
    const handleResult = await startSession(harness.request, 'mlv')
    const handleSession = handleResult.body.session as JsonObject
    assert.equal(handleSession.handle, 'mlv.bsky.social')
    assert.match(String(handleSession.did), /^did:plc:/)

    const didResult = await startSession(harness.request, 'did:plc:alpha123')
    const didSession = didResult.body.session as JsonObject
    assert.equal(didSession.did, 'did:plc:alpha123')
    assert.equal(didSession.handle, 'portable.user')

    const urlResult = await startSession(harness.request, 'https://example.com')
    const urlSession = urlResult.body.session as JsonObject
    assert.equal(urlSession.did, 'did:web:example.com')
    assert.equal(urlSession.handle, 'example.com')
  } finally {
    await harness.close()
  }
})

test('persists sessions, grants, proofs, and ledger state across session reads', async () => {
  const harness = await createHarness()

  try {
    const started = await startSession(harness.request, 'off-jal.test')
    const sessionId = started.sessionId
    assert.ok(sessionId)

    const current = await harness.request('/session/current', {}, sessionId)
    assert.equal(current.response.status, 200)
    const firstSession = current.body.session as JsonObject
    assert.equal(firstSession.handle, 'off-jal.test')
    assert.equal((firstSession.claimRequests as unknown[]).length, 2)
    assert.equal((current.body.ledger as unknown[]).length, 1)

    const requestId = String(((firstSession.claimRequests as JsonObject[])[0]).id)
    const approved = await harness.request(
      `/grants/${encodeURIComponent(requestId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ grantId: requestId }),
      },
      sessionId
    )
    assert.equal(approved.response.status, 200)
    assert.ok((approved.body.proofs as unknown[]).length >= 1)

    const reloaded = await harness.request('/session/current', {}, sessionId)
    const reloadedSession = reloaded.body.session as JsonObject
    assert.equal((reloadedSession.grants as unknown[]).length, 1)
    assert.ok((reloadedSession.proofs as unknown[]).length >= 1)
    assert.equal((reloaded.body.ledger as unknown[]).length, 2)
  } finally {
    await harness.close()
  }
})

test('approves proof-only grants, issues proofs, and revokes linked artifacts', async () => {
  const harness = await createHarness()

  try {
    const started = await startSession(harness.request, 'off-jal.test')
    const sessionId = started.sessionId
    assert.ok(sessionId)

    const current = await harness.request('/session/current', {}, sessionId)
    const session = current.body.session as JsonObject
    const requestId = String(
      ((session.claimRequests as JsonObject[]).find((entry) => String(entry.appId) === 'townhall-civic') as JsonObject).id
    )

    const approved = await harness.request(
      `/grants/${encodeURIComponent(requestId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ grantId: requestId }),
      },
      sessionId
    )
    assert.equal(approved.response.status, 200)
    assert.equal((approved.body.proofs as unknown[]).length, 2)

    const grant = approved.body.grant as JsonObject
    const grantId = String(grant.id)
    assert.equal(grant.status, 'approved')

    const revoked = await harness.request(
      `/grants/${encodeURIComponent(grantId)}/revoke`,
      {
        method: 'POST',
        body: JSON.stringify({ grantId, reason: 'User turned this surface private again.' }),
      },
      sessionId
    )
    assert.equal(revoked.response.status, 200)
    const revokedGrant = revoked.body.grant as JsonObject
    assert.equal(revokedGrant.status, 'revoked')

    const reloaded = await harness.request('/session/current', {}, sessionId)
    const proofs = (reloaded.body.session as JsonObject).proofs as JsonObject[]
    assert.ok(proofs.every((proof) => proof.status === 'revoked'))
    assert.equal((reloaded.body.ledger as unknown[]).length, 3)
  } finally {
    await harness.close()
  }
})

test('expires grants and proofs without treating them as active access', async () => {
  const harness = await createHarness()

  try {
    const started = await startSession(harness.request, 'off-jal.test')
    const sessionId = started.sessionId
    assert.ok(sessionId)

    const created = await harness.request(
      '/grants/request',
      {
        method: 'POST',
        body: JSON.stringify({
          appId: 'backup-sentinel',
          appName: 'Backup Sentinel',
          appKind: 'Community app',
          surface: 'public',
          requestedClaims: [{ type: 'has_backup_coverage', disclosure: 'proof-only' }],
          proofMode: 'proof-only',
          reason: 'This app only needs to know whether recovery coverage is active.',
          expiresAt: '2020-01-01T00:00:00.000Z',
        }),
      },
      sessionId
    )
    assert.equal(created.response.status, 200)

    const requestId = String((created.body as JsonObject).id)
    const approved = await harness.request(
      `/grants/${encodeURIComponent(requestId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ grantId: requestId }),
      },
      sessionId
    )
    assert.equal(approved.response.status, 200)

    const reloaded = await harness.request('/session/current', {}, sessionId)
    const grants = ((reloaded.body.session as JsonObject).grants as JsonObject[]).filter(
      (grant) => grant.appId === 'backup-sentinel'
    )
    const proofs = ((reloaded.body.session as JsonObject).proofs as JsonObject[]).filter(
      (proof) => proof.audienceAppId === 'backup-sentinel'
    )

    assert.equal(grants[0]?.status, 'expired')
    assert.equal(proofs[0]?.status, 'expired')
  } finally {
    await harness.close()
  }
})

test('uses PARA as a bounded verifier and returns review-needed when PARA cannot confirm a claim', async () => {
  const harness = await createHarness()

  try {
    const started = await startSession(harness.request, 'off-jal.test')
    const sessionId = started.sessionId
    assert.ok(sessionId)

    const created = await harness.request(
      '/grants/request',
      {
        method: 'POST',
        body: JSON.stringify({
          appId: 'dating-proof',
          appName: 'Dating Proof',
          appKind: 'Consumer app',
          surface: 'dating',
          requestedClaims: [{ type: 'has_party_affiliation_match', disclosure: 'proof-only' }],
          proofMode: 'proof-only',
          reason: 'Only a bounded affiliation match should be disclosed.',
          expiresAt: '14 days',
        }),
      },
      sessionId
    )
    assert.equal(created.response.status, 200)
    const requestId = String((created.body as JsonObject).id)

    const approved = await harness.request(
      `/grants/${encodeURIComponent(requestId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ grantId: requestId }),
      },
      sessionId
    )
    assert.equal(approved.response.status, 200)
    const proof = (approved.body.proofs as JsonObject[])[0]
    assert.equal(proof.claimType, 'has_party_affiliation_match')
    assert.equal(proof.outcome, 'bounded')
    assert.match(String(proof.statement), /bounded affiliation match/i)

    const unknown = await startSession(harness.request, 'unknown-citizen.test')
    const missingSessionId = unknown.sessionId
    assert.ok(missingSessionId)

    const missingRequest = await harness.request(
      '/grants/request',
      {
        method: 'POST',
        body: JSON.stringify({
          appId: 'civic-proof',
          appName: 'Civic Proof',
          appKind: 'Civic app',
          surface: 'civic',
          requestedClaims: [{ type: 'is_verified_public_figure', disclosure: 'proof-only' }],
          proofMode: 'proof-only',
          reason: 'Needs public-figure confirmation without raw PARA policy data.',
        }),
      },
      missingSessionId
    )
    assert.equal(missingRequest.response.status, 200)
    const missingRequestId = String((missingRequest.body as JsonObject).id)

    const preview = await harness.request(
      '/claims/verify',
      {
        method: 'POST',
        body: JSON.stringify({ requestId: missingRequestId }),
      },
      missingSessionId
    )
    assert.equal(preview.response.status, 200)
    const previewDetail = String(((preview.body.proofs as JsonObject[])[0]).detail)
    assert.match(previewDetail, /no subject match/i)

    const approveMissing = await harness.request(
      `/grants/${encodeURIComponent(missingRequestId)}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ grantId: missingRequestId }),
      },
      missingSessionId
    )
    assert.equal(approveMissing.response.status, 409)
  } finally {
    await harness.close()
  }
})

test('reports PARA provider status with supported claim coverage', async () => {
  const harness = await createHarness()

  try {
    const started = await startSession(harness.request, 'off-jal.test')
    const sessionId = started.sessionId
    assert.ok(sessionId)

    const status = await harness.request('/providers/para/status', {}, sessionId)
    assert.equal(status.response.status, 200)
    assert.equal(status.body.providerId, 'para.identity')
    assert.equal(status.body.compatibility, 'ready')
    assert.ok(Array.isArray(status.body.supportedClaims))
    assert.ok((status.body.supportedClaims as unknown[]).includes('is_verified_public_figure'))
  } finally {
    await harness.close()
  }
})

test('verifies wallet identity presentations with nonce, issuer, and replay protection', async () => {
  const harness = await createHarness()

  try {
    const started = await startSession(harness.request, 'off-jal.test')
    const sessionId = started.sessionId
    assert.ok(sessionId)

    const identityRequest = await harness.request(
      '/identity/request',
      {
        method: 'POST',
        body: JSON.stringify({
          audienceAppId: 'townhall-civic',
          audienceAppName: 'Townhall Civic',
          purpose: 'Confirm civic eligibility without storing raw identity data.',
          requestedElements: [
            {
              id: 'age_over_18',
              required: true,
              intentToStore: { mode: 'will-not-store' },
            },
            {
              id: 'citizenship',
              required: true,
              intentToStore: { mode: 'may-store', days: 30 },
            },
          ],
        }),
      },
      sessionId
    )
    assert.equal(identityRequest.response.status, 200)
    assert.match(String(identityRequest.body.nonce), /^[A-Za-z0-9_-]+$/)

    const requestId = String(identityRequest.body.id)
    const presented = await harness.request(
      '/identity/demo/present',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          selectedElementIds: ['age_over_18', 'citizenship'],
        }),
      },
      sessionId
    )
    assert.equal(presented.response.status, 200)

    const verified = await harness.request(
      '/identity/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          presentation: presented.body.presentation,
        }),
      },
      sessionId
    )
    assert.equal(verified.response.status, 200)
    assert.equal(verified.body.valid, true)
    assert.deepEqual(verified.body.disclosedClaims, {
      age_over_18: true,
      citizenship: 'MX',
    })

    const replay = await harness.request(
      '/identity/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          presentation: presented.body.presentation,
        }),
      },
      sessionId
    )
    assert.equal(replay.response.status, 409)
    assert.equal(replay.body.valid, false)
    assert.match(String((replay.body.errors as string[])[0]), /not active/)
  } finally {
    await harness.close()
  }
})

test('rejects tampered wallet presentations', async () => {
  const harness = await createHarness()

  try {
    const started = await startSession(harness.request, 'off-jal.test')
    const sessionId = started.sessionId
    assert.ok(sessionId)

    const identityRequest = await harness.request(
      '/identity/request',
      {
        method: 'POST',
        body: JSON.stringify({
          audienceAppId: 'age-gate',
          audienceAppName: 'Age Gate',
          purpose: 'Check adult eligibility.',
          requestedElements: [
            {
              id: 'age_over_18',
              required: true,
              intentToStore: { mode: 'will-not-store' },
            },
          ],
        }),
      },
      sessionId
    )
    assert.equal(identityRequest.response.status, 200)

    const requestId = String(identityRequest.body.id)
    const presented = await harness.request(
      '/identity/demo/present',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          selectedElementIds: ['age_over_18'],
        }),
      },
      sessionId
    )
    assert.equal(presented.response.status, 200)

    const presentation = presented.body.presentation as JsonObject
    const tampered = {
      ...presentation,
      disclosedClaims: {
        ...(presentation.disclosedClaims as JsonObject),
        citizenship: 'MX',
      },
    }

    const verified = await harness.request(
      '/identity/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          presentation: tampered,
        }),
      },
      sessionId
    )
    assert.equal(verified.response.status, 409)
    assert.equal(verified.body.valid, false)
    assert.ok(
      (verified.body.errors as string[]).some((error) =>
        /not requested|signature is invalid/.test(error)
      )
    )
  } finally {
    await harness.close()
  }
})
