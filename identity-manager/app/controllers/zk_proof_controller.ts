import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HttpContext } from '@adonisjs/core/http'
import { getDb } from '../../src/db/connection.js'
import { verifyAgeProof, verifyNullifierProof } from '../../src/services/zkpService.js'
import { getSessionId } from '#support/http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ZKP_DIR = join(__dirname, '..', '..', '..', 'zkp', 'out')
const PROVER_HTML = join(__dirname, '..', '..', '..', 'zkp', 'prover', 'prover.html')

export default class ZkProofController {
  async zkpVerify(ctx: HttpContext) {
    getSessionId(ctx)

    const body = ctx.request.body() as { proof: unknown; publicSignals: string[] }

    const valid = await verifyAgeProof(body.proof, body.publicSignals)
    if (!valid) {
      return ctx.response.status(400).send({ valid: false, reason: 'invalid_proof' })
    }

    const commitment = body.publicSignals[0] as string
    const db = getDb()
    const artifact = db.prepare(
      'SELECT status FROM proof_artifacts WHERE commitment = ? ORDER BY issued_at DESC LIMIT 1'
    ).get(commitment) as { status: string } | undefined

    if (!artifact) {
      return ctx.response.status(400).send({ valid: false, reason: 'unknown_commitment' })
    }

    if (artifact.status === 'revoked' || artifact.status === 'suspended') {
      const reason = artifact.status === 'revoked' ? 'credential_revoked' : 'credential_suspended'
      return ctx.response.status(400).send({ valid: false, reason })
    }

    return ctx.response.send({ valid: true, commitment })
  }

  async zkpNullifier(ctx: HttpContext) {
    const sessionId = getSessionId(ctx)

    const body = ctx.request.body() as { proof: unknown; publicSignals: string[]; communityId: string }

    const valid = await verifyNullifierProof(body.proof, body.publicSignals)
    if (!valid) {
      return ctx.response.status(400).send({ valid: false, reason: 'invalid_proof' })
    }

    const commitment = body.publicSignals[0] as string
    const nullifier = body.publicSignals[1] as string
    const circuitCommunityId = body.publicSignals[2] as string

    if (circuitCommunityId !== body.communityId) {
      return ctx.response.status(400).send({ valid: false, reason: 'community_mismatch' })
    }

    const db = getDb()
    const artifact = db.prepare(
      'SELECT status FROM proof_artifacts WHERE commitment = ? ORDER BY issued_at DESC LIMIT 1'
    ).get(commitment) as { status: string } | undefined

    if (!artifact) {
      return ctx.response.status(400).send({ valid: false, reason: 'unknown_commitment' })
    }

    if (artifact.status === 'revoked' || artifact.status === 'suspended') {
      const reason = artifact.status === 'revoked' ? 'credential_revoked' : 'credential_suspended'
      return ctx.response.status(400).send({ valid: false, reason })
    }

    const existing = db.prepare(
      'SELECT id FROM nullifiers WHERE nullifier = ? AND community_id = ?'
    ).get(nullifier, body.communityId) as { id: string } | undefined

    if (existing) {
      return ctx.response.status(400).send({ valid: false, reason: 'nullifier_already_used' })
    }

    const { randomUUID } = await import('node:crypto')
    db.prepare(`
      INSERT INTO nullifiers (id, nullifier, community_id, commitment, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`nullifier-${randomUUID()}`, nullifier, body.communityId, commitment, sessionId, new Date().toISOString())

    return ctx.response.send({ valid: true, commitment, nullifier })
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

  nullifierProverWasm({ response }: HttpContext) {
    const wasm = readFileSync(join(ZKP_DIR, 'nullifier_proof_js', 'nullifier_proof.wasm'))
    return response.header('content-type', 'application/wasm').send(wasm)
  }

  nullifierProverZkey({ response }: HttpContext) {
    const zkey = readFileSync(join(ZKP_DIR, 'nullifier_proof_final.zkey'))
    return response.header('content-type', 'application/octet-stream').send(zkey)
  }
}
