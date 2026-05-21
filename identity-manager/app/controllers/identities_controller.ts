import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { HttpContext } from '@adonisjs/core/http'
import { getDb } from '../../src/db/connection.js'
import { createIdentityRequest, createDemoWalletPresentation, verifyWalletPresentation } from '../../src/services/identityWallet.js'
import { simulateIneExtraction, simulateIneVerification } from '../../src/services/ineSimulation.js'
import { verifyAgeProof, verifyNullifierProof, computeCommitment } from '../../src/services/zkpService.js'
import { hydrateSession } from '../../src/services/sessionService.js'
import { createAnonymousProfile } from '../../src/services/anonymousProfileService.js'
import { requireSessionId, validateBody, t } from '#support/http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ZKP_DIR = join(__dirname, '..', '..', '..', 'zkp', 'out')
const PROVER_HTML = join(__dirname, '..', '..', '..', 'zkp', 'prover', 'prover.html')

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

const chatKeyBackupSchema = z.object({
  version: z.number().int().positive(),
  deviceId: z.string().min(1).max(256),
  ciphertext: z.string().min(1),
  encryptionMetadata: z.record(z.unknown()).default({}),
}).strict()

export default class IdentitiesController {
  async request(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    const body = validateBody(ctx, identityRequestSchema)
    if (!sessionId || !body) return

    const req = createIdentityRequest(sessionId, body)
    const db = getDb()
    db.prepare(`
      INSERT INTO identity_requests (id, session_id, nonce, audience_app_id, audience_app_name, purpose, merchant_identifier, requested_elements_json, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.id, req.sessionId, req.nonce, req.audienceAppId, req.audienceAppName, req.purpose, req.merchantIdentifier, JSON.stringify(req.requestedElements), req.status, req.createdAt, req.expiresAt)

    return ctx.response.status(201).send(req)
  }

  async present(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    const body = validateBody(ctx, presentationSchema)
    if (!sessionId || !body) return

    const db = getDb()
    const row = db.prepare('SELECT * FROM identity_requests WHERE id = ? AND session_id = ?').get(body.requestId, sessionId) as Record<string, unknown> | undefined
    if (!row) {
      return ctx.response.status(404).send({ error: 'Identity request not found' })
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

    const session = hydrateSession(sessionId)
    const presentation = createDemoWalletPresentation({
      request: identityRequest,
      subjectDid: session.did,
      selectedElementIds: body.selectedElementIds as Array<'age_over_18' | 'age_over_21' | 'citizenship' | 'district_hash' | 'curp_hash' | 'verified_public_figure'>,
    })

    return ctx.response.send(presentation)
  }

  async verify(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    const body = validateBody(ctx, verifyPresentationSchema)
    if (!sessionId || !body) return

    const db = getDb()
    const row = db.prepare('SELECT * FROM identity_requests WHERE id = ? AND session_id = ?').get(body.requestId, sessionId) as Record<string, unknown> | undefined
    if (!row) {
      return ctx.response.status(404).send({ error: 'Identity request not found' })
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

    const presentation = body.presentation as import('../../src/types/index.js').M8WalletPresentation
    const result = verifyWalletPresentation(identityRequest, presentation)

    if (result.valid) {
      db.prepare('UPDATE identity_requests SET status = ?, used_at = ? WHERE id = ?').run('used', new Date().toISOString(), body.requestId)
    }

    return ctx.response.send(result)
  }

  async createChatKeyBackup(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    const parsed = chatKeyBackupSchema.safeParse(ctx.request.body())
    if (!sessionId) return
    if (!parsed.success) {
      return ctx.response.status(400).send({
        error: 'Invalid encrypted chat key backup payload',
        issues: parsed.error.issues,
      })
    }

    const body = parsed.data
    const db = getDb()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO chat_key_backups
        (session_id, version, device_id, ciphertext, encryption_metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        version = excluded.version,
        device_id = excluded.device_id,
        ciphertext = excluded.ciphertext,
        encryption_metadata_json = excluded.encryption_metadata_json,
        updated_at = excluded.updated_at
    `).run(sessionId, body.version, body.deviceId, body.ciphertext, JSON.stringify(body.encryptionMetadata), now, now)

    db.prepare(`
      INSERT INTO ledger (session_id, action, target_type, target_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, 'ChatKeyBackupUpserted', 'chat_key_backup', sessionId, JSON.stringify({ version: body.version, deviceId: body.deviceId }), now)

    return ctx.response.send({ ok: true, updatedAt: now })
  }

  async getChatKeyBackup(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const db = getDb()
    const row = db.prepare(`
      SELECT version, device_id, ciphertext, encryption_metadata_json, created_at, updated_at
      FROM chat_key_backups
      WHERE session_id = ?
    `).get(sessionId) as {
      version: number
      device_id: string
      ciphertext: string
      encryption_metadata_json: string
      created_at: string
      updated_at: string
    } | undefined

    if (!row) {
      return ctx.response.status(404).send({ error: 'Chat key backup not found' })
    }

    return ctx.response.send({
      version: row.version,
      deviceId: row.device_id,
      ciphertext: row.ciphertext,
      encryptionMetadata: JSON.parse(row.encryption_metadata_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  }

  async deleteChatKeyBackup(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const db = getDb()
    const now = new Date().toISOString()
    const result = db.prepare('DELETE FROM chat_key_backups WHERE session_id = ?').run(sessionId)

    db.prepare(`
      INSERT INTO ledger (session_id, action, target_type, target_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, 'ChatKeyBackupDeleted', 'chat_key_backup', sessionId, JSON.stringify({ deleted: result.changes > 0 }), now)

    return ctx.response.send({ deleted: result.changes > 0, deletedAt: now })
  }

  async ineAnalyze(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const body = ctx.request.body() as { inePhotoBase64?: string; selfieBase64?: string; simulatedMode?: boolean }
    const result = simulateIneExtraction(body.inePhotoBase64 ?? '')
    return ctx.response.send(result)
  }

  async ineVerify(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const body = ctx.request.body() as { extracted: import('../../src/types/index.js').IneExtractedData; selfieBase64?: string; consentToStore?: boolean }
    const result = simulateIneVerification(body.extracted, body.selfieBase64 ?? '')
    return ctx.response.send(result)
  }

  async ineCredential(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const body = ctx.request.body() as { extracted: import('../../src/types/index.js').IneExtractedData; verification: import('../../src/types/index.js').IneVerificationResult }
    const db = getDb()
    const $t = t(ctx)

    const birthDate = new Date(body.extracted.birthDate)
    const now = new Date()
    const ageYears = now.getFullYear() - birthDate.getFullYear()
    const hadBirthday = now.getMonth() > birthDate.getMonth() ||
      (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate())
    const age = ageYears + (hadBirthday ? 0 : -1)

    const claims = {
      age_over_18: age >= 18,
      age_over_21: age >= 21,
      citizenship: 'MX',
      district_hash: `sha256:${createHash('sha256').update(body.extracted.address.state + body.extracted.address.postalCode).digest('hex').slice(0, 16)}`,
      curp_hash: `sha256:${createHash('sha256').update(body.extracted.curp).digest('hex').slice(0, 16)}`,
    }

    const grantId = `grant-ine-${randomUUID()}`
    db.prepare(`
      INSERT INTO grants
      (id, session_id, app_id, app_name, app_kind, surface, requested_claims_json, proof_mode, status, reason, requested_at, issued_at, expires_at, review_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      grantId, sessionId, 'para.identity', 'PARA Identity', 'Verifier', 'civic',
      JSON.stringify([{ type: 'has_para_verification', disclosure: 'proof-only' }]),
      'proof-only', 'approved', $t('ine.grantReason'), new Date().toISOString(),
      new Date().toISOString(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      $t('ine.reviewNote'),
    )

    const birthYear = birthDate.getFullYear()
    const salt = Math.floor(Math.random() * 1e12)
    const commitment = await computeCommitment(birthYear, salt)

    const proofArtifactId = `proof-ine-${randomUUID()}`
    const revocationHash = createHash('sha256')
      .update(`${proofArtifactId}:${sessionId}:${salt}`)
      .digest('hex')

    db.prepare(`
      INSERT INTO proof_artifacts
      (id, session_id, grant_id, request_id, claim_type, outcome, statement, audience_app_id, audience_app_name, surface, status, issued_at, expires_at, revocation_hash, commitment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      proofArtifactId, sessionId, grantId, 'ine-verification', 'has_para_verification', 'verified',
      `${$t('ine.statement')}: ${body.extracted.fullName} (${body.extracted.curp.slice(0, 4)}****)`,
      'para.identity', 'PARA Identity', 'civic', 'active', new Date().toISOString(),
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      revocationHash, commitment,
    )

    db.prepare(`
      INSERT INTO ledger (session_id, action, target_type, target_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sessionId, $t('ledger.action.verified'), 'identity', proofArtifactId,
      JSON.stringify({ reason: $t('ledger.reason.ineCompleted'), verificationId: body.verification.verificationId, curpHash: claims.curp_hash, commitment, revocationHash }),
      new Date().toISOString(),
    )

    const anonymousProfile = createAnonymousProfile(sessionId, $t('anonymous.prefix'))

    return ctx.response.send({
      credential: { claims, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
      proofArtifactId,
      verificationId: body.verification.verificationId,
      salt,
      birthYear,
      commitment,
      revocationHash,
      anonymousProfile,
    })
  }

  async zkpVerify(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const body = ctx.request.body() as { proof: unknown; publicSignals: string[] }
    const $t = t(ctx)

    const valid = await verifyAgeProof(body.proof, body.publicSignals)
    if (!valid) {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.invalidProof') })
    }

    const commitment = body.publicSignals[0] as string
    const db = getDb()
    const artifact = db.prepare(
      'SELECT status FROM proof_artifacts WHERE commitment = ? ORDER BY issued_at DESC LIMIT 1'
    ).get(commitment) as { status: string } | undefined

    if (!artifact) {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.unknownCommitment') })
    }

    if (artifact.status === 'revoked') {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.credentialRevoked') })
    }

    return ctx.response.send({ valid: true, commitment })
  }

  async revoke(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const body = ctx.request.body() as { revocationHash: string; reason?: string }
    const db = getDb()
    const $t = t(ctx)

    const artifact = db.prepare(
      'SELECT id, session_id, status FROM proof_artifacts WHERE revocation_hash = ?'
    ).get(body.revocationHash) as { id: string; session_id: string; status: string } | undefined

    if (!artifact) {
      return ctx.response.status(404).send({ error: $t('errors.revoke.notFound') })
    }

    if (artifact.session_id !== sessionId) {
      return ctx.response.status(403).send({ error: $t('errors.revoke.wrongSession') })
    }

    if (artifact.status === 'revoked') {
      return ctx.response.status(400).send({ error: $t('errors.revoke.alreadyRevoked') })
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE proof_artifacts SET status = ?, revoked_at = ? WHERE id = ?').run('revoked', now, artifact.id)

    db.prepare(`
      INSERT INTO ledger (session_id, action, target_type, target_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sessionId, $t('ledger.action.revoked'), 'identity', artifact.id,
      JSON.stringify({ reason: body.reason ?? $t('ledger.reason.userRevoked'), revocationHash: body.revocationHash }),
      now,
    )

    return ctx.response.send({ revoked: true, revokedAt: now })
  }

  async crl(ctx: HttpContext) {
    const db = getDb()
    const since = (ctx.request.qs() as { since?: string }).since

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

    return ctx.response.send({
      revokedHashes: rows.map((r) => r.revocation_hash),
      updatedAt: new Date().toISOString(),
    })
  }

  zkpProverHtml({ response }: HttpContext) {
    const html = readFileSync(PROVER_HTML, 'utf8')
    return response.header('content-type', 'text/html').send(html)
  }

  zkpProverWasm({ response }: HttpContext) {
    const wasm = readFileSync(join(ZKP_DIR, 'ine_age_proof_js', 'ine_age_proof.wasm'))
    return response.header('content-type', 'application/wasm').send(wasm)
  }

  zkpProverZkey({ response }: HttpContext) {
    const zkey = readFileSync(join(ZKP_DIR, 'ine_age_proof_final.zkey'))
    return response.header('content-type', 'application/octet-stream').send(zkey)
  }

  async zkpNullifier(ctx: HttpContext) {
    const sessionId = await requireSessionId(ctx)
    if (!sessionId) return

    const body = ctx.request.body() as { proof: unknown; publicSignals: string[]; communityId: string }
    const $t = t(ctx)

    const valid = await verifyNullifierProof(body.proof, body.publicSignals)
    if (!valid) {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.invalidProof') })
    }

    const commitment = body.publicSignals[0] as string
    const nullifier = body.publicSignals[1] as string
    const circuitCommunityId = body.publicSignals[2] as string

    if (circuitCommunityId !== body.communityId) {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.communityMismatch') })
    }

    const db = getDb()
    const artifact = db.prepare(
      'SELECT status FROM proof_artifacts WHERE commitment = ? ORDER BY issued_at DESC LIMIT 1'
    ).get(commitment) as { status: string } | undefined

    if (!artifact) {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.unknownCommitment') })
    }

    if (artifact.status === 'revoked') {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.credentialRevoked') })
    }

    const existing = db.prepare(
      'SELECT id FROM nullifiers WHERE nullifier = ? AND community_id = ?'
    ).get(nullifier, body.communityId) as { id: string } | undefined

    if (existing) {
      return ctx.response.status(400).send({ valid: false, reason: $t('errors.zkp.nullifierUsed') })
    }

    db.prepare(`
      INSERT INTO nullifiers (id, nullifier, community_id, commitment, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`nullifier-${randomUUID()}`, nullifier, body.communityId, commitment, sessionId, new Date().toISOString())

    return ctx.response.send({ valid: true, commitment, nullifier })
  }

  nullifierProverWasm({ response }: HttpContext) {
    const wasm = readFileSync(join(ZKP_DIR, 'nullifier_proof_js', 'nullifier_proof.wasm'))
    return response.header('content-type', 'application/wasm').send(wasm)
  }

  nullifierProverZkey({ response }: HttpContext) {
    const zkey = readFileSync(join(ZKP_DIR, 'nullifier_proof_final.zkey'))
    return response.header('content-type', 'application/octet-stream').send(zkey)
  }
}
