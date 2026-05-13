import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { createIdentityRequest, createDemoWalletPresentation, verifyWalletPresentation } from '../services/identityWallet.js'
import { simulateIneExtraction, simulateIneVerification } from '../services/ineSimulation.js'
import { verifyAgeProof, verifyNullifierProof, computeCommitment } from '../services/zkpService.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getDb } from '../db/connection.js'
import { hydrateSession } from '../services/sessionService.js'
import { createAnonymousProfile } from '../services/anonymousProfileService.js'

const identityRequestSchema = z.object({
  audienceAppId: z.string().min(1),
  audienceAppName: z.string().min(1),
  purpose: z.string().min(1),
  merchantIdentifier: z.string().optional(),
  requestedElements: z.array(z.object({
    id: z.enum(['age_over_18', 'age_over_21', 'citizenship', 'district_hash', 'curp_hash', 'verified_public_figure']),
    intentToStore: z.union([
      z.object({ mode: z.literal('will-not-store') }),
      z.object({ mode: z.literal('may-store'), days: z.number().int().positive() }),
      z.object({ mode: z.literal('may-store-until-revoked') }),
    ]),
    required: z.boolean(),
  })).min(1),
  expiresInSeconds: z.number().int().min(30).max(900).optional(),
})

const presentationSchema = z.object({
  requestId: z.string().min(1),
  subjectDid: z.string().min(1),
  selectedElementIds: z.array(z.string()).optional(),
})

const verifyPresentationSchema = z.object({
  requestId: z.string().min(1),
  presentation: z.record(z.unknown()),
})

export async function identityRoutes(fastify: FastifyInstance) {
  fastify.post('/identity/request', { preHandler: requireAuth }, async (request, reply) => {
    const body = identityRequestSchema.parse(request.body)
    const req = createIdentityRequest(request.sessionId!, body)

    const db = getDb()
    db.prepare(`
      INSERT INTO identity_requests (id, session_id, nonce, audience_app_id, audience_app_name, purpose, merchant_identifier, requested_elements_json, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.id, req.sessionId, req.nonce, req.audienceAppId, req.audienceAppName, req.purpose, req.merchantIdentifier, JSON.stringify(req.requestedElements), req.status, req.createdAt, req.expiresAt)

    return reply.status(201).send(req)
  })

  fastify.post('/identity/present', { preHandler: requireAuth }, async (request, reply) => {
    const body = presentationSchema.parse(request.body)
    const db = getDb()
    const row = db.prepare('SELECT * FROM identity_requests WHERE id = ? AND session_id = ?').get(body.requestId, request.sessionId) as Record<string, unknown> | undefined
    if (!row) {
      return reply.status(404).send({ error: request.t('errors.identity.requestNotFound') })
    }

    const identityRequest = {
      id: row.id as string,
      sessionId: row.session_id as string,
      nonce: row.nonce as string,
      audienceAppId: row.audience_app_id as string,
      audienceAppName: row.audience_app_name as string,
      purpose: row.purpose as string,
      merchantIdentifier: row.merchant_identifier as string,
      requestedElements: JSON.parse(row.requested_elements_json as string),
      status: row.status as 'active' | 'used' | 'expired',
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
      usedAt: row.used_at as string | null,
    }

    const session = hydrateSession(request.sessionId!)
    const presentation = createDemoWalletPresentation({
      request: identityRequest,
      subjectDid: session.did,
      selectedElementIds: body.selectedElementIds as Array<'age_over_18' | 'age_over_21' | 'citizenship' | 'district_hash' | 'curp_hash' | 'verified_public_figure'>,
    })

    return reply.send(presentation)
  })

  fastify.post('/identity/verify', { preHandler: requireAuth }, async (request, reply) => {
    const body = verifyPresentationSchema.parse(request.body)
    const db = getDb()
    const row = db.prepare('SELECT * FROM identity_requests WHERE id = ? AND session_id = ?').get(body.requestId, request.sessionId) as Record<string, unknown> | undefined
    if (!row) {
      return reply.status(404).send({ error: request.t('errors.identity.requestNotFound') })
    }

    const identityRequest = {
      id: row.id as string,
      sessionId: row.session_id as string,
      nonce: row.nonce as string,
      audienceAppId: row.audience_app_id as string,
      audienceAppName: row.audience_app_name as string,
      purpose: row.purpose as string,
      merchantIdentifier: row.merchant_identifier as string,
      requestedElements: JSON.parse(row.requested_elements_json as string),
      status: row.status as 'active' | 'used' | 'expired',
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
      usedAt: row.used_at as string | null,
    }

    const presentation = body.presentation as import('../types/index.ts').M8WalletPresentation
    const result = verifyWalletPresentation(identityRequest, presentation)

    if (result.valid) {
      db.prepare('UPDATE identity_requests SET status = ?, used_at = ? WHERE id = ?').run('used', new Date().toISOString(), body.requestId)
    }

    return reply.send(result)
  })

  // ─── INE Simulation Routes ─────────────────────────────────────────────────

  fastify.post('/identity/ine/analyze', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { inePhotoBase64?: string; selfieBase64?: string; simulatedMode?: boolean }
    const inePhotoBase64 = body.inePhotoBase64 ?? ''

    const result = simulateIneExtraction(inePhotoBase64)
    return reply.send(result)
  })

  fastify.post('/identity/ine/verify', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { extracted: import('../types/index.ts').IneExtractedData; selfieBase64?: string; consentToStore?: boolean }
    const selfieBase64 = body.selfieBase64 ?? ''

    const result = simulateIneVerification(body.extracted, selfieBase64)
    return reply.send(result)
  })

  fastify.post('/identity/ine/credential', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { extracted: import('../types/index.ts').IneExtractedData; verification: import('../types/index.ts').IneVerificationResult }
    const db = getDb()

    // Calculate age-based claims from birthDate
    const birthDate = new Date(body.extracted.birthDate)
    const now = new Date()
    const ageYears = now.getFullYear() - birthDate.getFullYear()
    const hadBirthday = now.getMonth() > birthDate.getMonth() ||
      (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate())
    const age = ageYears + (hadBirthday ? 0 : -1)

    // Build claims from verified INE data
    const claims = {
      age_over_18: age >= 18,
      age_over_21: age >= 21,
      citizenship: 'MX',
      district_hash: `sha256:${createHash('sha256').update(body.extracted.address.state + body.extracted.address.postalCode).digest('hex').slice(0, 16)}`,
      curp_hash: `sha256:${createHash('sha256').update(body.extracted.curp).digest('hex').slice(0, 16)}`,
    }

    // Create a dummy grant for the INE verification (required by FK constraint)
    const grantId = `grant-ine-${randomUUID()}`
    db.prepare(`
      INSERT INTO grants
      (id, session_id, app_id, app_name, app_kind, surface, requested_claims_json, proof_mode, status, reason, requested_at, issued_at, expires_at, review_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      grantId,
      request.sessionId!,
      'para.identity',
      'PARA Identity',
      'Verifier',
      'civic',
      JSON.stringify([{ type: 'has_para_verification', disclosure: 'proof-only' }]),
      'proof-only',
      'approved',
      request.t('ine.grantReason'),
      new Date().toISOString(),
      new Date().toISOString(),
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      request.t('ine.reviewNote'),
    )

    // Generate ZKP witness data for client-side proving
    const birthYear = birthDate.getFullYear()
    const salt = Math.floor(Math.random() * 1e12)
    const commitment = await computeCommitment(birthYear, salt)

    // Create a proof artifact for the INE verification
    const proofArtifactId = `proof-ine-${randomUUID()}`
    const revocationHash = createHash('sha256')
      .update(`${proofArtifactId}:${request.sessionId!}:${salt}`)
      .digest('hex')

    db.prepare(`
      INSERT INTO proof_artifacts
      (id, session_id, grant_id, request_id, claim_type, outcome, statement, audience_app_id, audience_app_name, surface, status, issued_at, expires_at, revocation_hash, commitment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      proofArtifactId,
      request.sessionId!,
      grantId,
      'ine-verification',
      'has_para_verification',
      'verified',
      `${request.t('ine.statement')}: ${body.extracted.fullName} (${body.extracted.curp.slice(0, 4)}****)`,
      'para.identity',
      'PARA Identity',
      'civic',
      'active',
      new Date().toISOString(),
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      revocationHash,
      commitment,
    )

    // Also write ledger entry
    db.prepare(`
      INSERT INTO ledger (session_id, action, target_type, target_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      request.sessionId!,
      request.t('ledger.action.verified'),
      'identity',
      proofArtifactId,
      JSON.stringify({ reason: request.t('ledger.reason.ineCompleted'), verificationId: body.verification.verificationId, curpHash: claims.curp_hash, commitment, revocationHash }),
      new Date().toISOString(),
    )

    // Anonymous by default: create anonymous profile upon credential issuance
    const anonymousProfile = createAnonymousProfile(request.sessionId!, request.t('anonymous.prefix'))

    return reply.send({
      credential: {
        claims,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      proofArtifactId,
      verificationId: body.verification.verificationId,
      salt,
      birthYear,
      commitment,
      revocationHash,
      anonymousProfile,
    })
  })

  // ─── ZKP Verification Route ────────────────────────────────────────────────
  // The proof is generated on the user's device (WebView prover).
  // This endpoint only verifies the proof and checks revocation status.

  fastify.post('/identity/ine/zkp-verify', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      proof: unknown
      publicSignals: string[]
    }

    const valid = await verifyAgeProof(body.proof, body.publicSignals)
    if (!valid) {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.invalidProof') })
    }

    const commitment = body.publicSignals[0] as string

    // Check revocation status
    const db = getDb()
    const artifact = db.prepare(
      'SELECT status FROM proof_artifacts WHERE commitment = ? ORDER BY issued_at DESC LIMIT 1'
    ).get(commitment) as { status: string } | undefined

    if (!artifact) {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.unknownCommitment') })
    }

    if (artifact.status === 'revoked') {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.credentialRevoked') })
    }

    return reply.send({ valid: true, commitment })
  })

  // ─── Credential Revocation ─────────────────────────────────────────────────

  fastify.post('/identity/revoke', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { revocationHash: string; reason?: string }
    const db = getDb()

    const artifact = db.prepare(
      'SELECT id, session_id, status FROM proof_artifacts WHERE revocation_hash = ?'
    ).get(body.revocationHash) as { id: string; session_id: string; status: string } | undefined

    if (!artifact) {
      return reply.status(404).send({ error: request.t('errors.revoke.notFound') })
    }

    if (artifact.session_id !== request.sessionId!) {
      return reply.status(403).send({ error: request.t('errors.revoke.wrongSession') })
    }

    if (artifact.status === 'revoked') {
      return reply.status(400).send({ error: request.t('errors.revoke.alreadyRevoked') })
    }

    const now = new Date().toISOString()
    db.prepare(`
      UPDATE proof_artifacts SET status = ?, revoked_at = ? WHERE id = ?
    `).run('revoked', now, artifact.id)

    db.prepare(`
      INSERT INTO ledger (session_id, action, target_type, target_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      request.sessionId!,
      request.t('ledger.action.revoked'),
      'identity',
      artifact.id,
      JSON.stringify({ reason: body.reason ?? request.t('ledger.reason.userRevoked'), revocationHash: body.revocationHash }),
      now,
    )

    return reply.send({ revoked: true, revokedAt: now })
  })

  // ─── Certificate Revocation List (CRL) ─────────────────────────────────────

  fastify.get('/identity/crl', async (_request, reply) => {
    const db = getDb()
    const since = (_request.query as { since?: string }).since

    let rows: { revocation_hash: string; revoked_at: string }[]
    if (since) {
      rows = db.prepare(
        'SELECT revocation_hash, revoked_at FROM proof_artifacts WHERE status = ? AND revoked_at > ?'
      ).all('revoked', since) as typeof rows
    } else {
      rows = db.prepare(
        'SELECT revocation_hash, revoked_at FROM proof_artifacts WHERE status = ?'
      ).all('revoked') as typeof rows
    }

    return reply.send({
      revokedHashes: rows.map((r) => r.revocation_hash),
      updatedAt: new Date().toISOString(),
    })
  })

  // ─── Static ZKP Prover Assets ──────────────────────────────────────────────

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const ZKP_DIR = join(__dirname, '..', '..', 'zkp', 'out')
  const PROVER_HTML = join(__dirname, '..', '..', 'zkp', 'prover', 'prover.html')

  fastify.get('/identity/ine/zkp-prover.html', async (_request, reply) => {
    const html = readFileSync(PROVER_HTML, 'utf8')
    return reply.header('content-type', 'text/html').send(html)
  })

  fastify.get('/identity/ine/zkp-prover.wasm', async (_request, reply) => {
    const wasm = readFileSync(join(ZKP_DIR, 'ine_age_proof_js', 'ine_age_proof.wasm'))
    return reply.header('content-type', 'application/wasm').send(wasm)
  })

  fastify.get('/identity/ine/zkp-prover.zkey', async (_request, reply) => {
    const zkey = readFileSync(join(ZKP_DIR, 'ine_age_proof_final.zkey'))
    return reply.header('content-type', 'application/octet-stream').send(zkey)
  })

  // ─── Nullifier Verification ────────────────────────────────────────────────

  fastify.post('/identity/ine/zkp-nullifier', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      proof: unknown
      publicSignals: string[]
      communityId: string
    }

    const valid = await verifyNullifierProof(body.proof, body.publicSignals)
    if (!valid) {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.invalidProof') })
    }

    // publicSignals: [commitment, nullifier, communityId, currentYear, ageThreshold]
    const commitment = body.publicSignals[0] as string
    const nullifier = body.publicSignals[1] as string
    const circuitCommunityId = body.publicSignals[2] as string

    if (circuitCommunityId !== body.communityId) {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.communityMismatch') })
    }

    const db = getDb()

    // Check credential is active
    const artifact = db.prepare(
      'SELECT status FROM proof_artifacts WHERE commitment = ? ORDER BY issued_at DESC LIMIT 1'
    ).get(commitment) as { status: string } | undefined

    if (!artifact) {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.unknownCommitment') })
    }

    if (artifact.status === 'revoked') {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.credentialRevoked') })
    }

    // Check nullifier hasn't been used for this community
    const existing = db.prepare(
      'SELECT id FROM nullifiers WHERE nullifier = ? AND community_id = ?'
    ).get(nullifier, body.communityId) as { id: string } | undefined

    if (existing) {
      return reply.status(400).send({ valid: false, reason: request.t('errors.zkp.nullifierUsed') })
    }

    // Store the nullifier
    db.prepare(`
      INSERT INTO nullifiers (id, nullifier, community_id, commitment, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `nullifier-${randomUUID()}`,
      nullifier,
      body.communityId,
      commitment,
      request.sessionId!,
      new Date().toISOString(),
    )

    return reply.send({ valid: true, commitment, nullifier })
  })

  // ─── Nullifier Prover Assets ───────────────────────────────────────────────

  fastify.get('/identity/ine/nullifier-prover.wasm', async (_request, reply) => {
    const wasm = readFileSync(join(ZKP_DIR, 'nullifier_proof_js', 'nullifier_proof.wasm'))
    return reply.header('content-type', 'application/wasm').send(wasm)
  })

  fastify.get('/identity/ine/nullifier-prover.zkey', async (_request, reply) => {
    const zkey = readFileSync(join(ZKP_DIR, 'nullifier_proof_final.zkey'))
    return reply.header('content-type', 'application/octet-stream').send(zkey)
  })
}
