import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// @ts-expect-error — no ESM types available for snarkjs
import { groth16 } from 'snarkjs'
// @ts-expect-error — no ESM types available for circomlibjs
import { buildPoseidon } from 'circomlibjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_ROOT = join(__dirname, '..', '..')
const ZKP_OUT = join(PROJECT_ROOT, 'zkp', 'out')

// ─── IneAgeProof artifacts ────────────────────────────────────────────────
const AGE_WASM = join(ZKP_OUT, 'ine_age_proof_js', 'ine_age_proof.wasm')
const AGE_ZKEY = join(ZKP_OUT, 'ine_age_proof_final.zkey')
const AGE_VKEY = join(ZKP_OUT, 'ine_age_proof_vkey.json')

// ─── NullifierProof artifacts ─────────────────────────────────────────────
const NULL_WASM = join(ZKP_OUT, 'nullifier_proof_js', 'nullifier_proof.wasm')
const NULL_ZKEY = join(ZKP_OUT, 'nullifier_proof_final.zkey')
const NULL_VKEY = join(ZKP_OUT, 'nullifier_proof_vkey.json')

let _poseidon: Awaited<ReturnType<typeof buildPoseidon>> | null = null

async function getPoseidon() {
  if (!_poseidon) {
    _poseidon = await buildPoseidon()
  }
  return _poseidon
}

function loadVkey(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export interface AgeProofInput {
  birthYear: number
  salt: number
  currentYear: number
  ageThreshold: number
}

export interface AgeProofResult {
  proof: unknown
  publicSignals: string[]
  commitment: string
}

export interface NullifierProofInput {
  birthYear: number
  salt: number
  communityId: number
  currentYear: number
  ageThreshold: number
}

export interface NullifierProofResult {
  proof: unknown
  publicSignals: string[]
  commitment: string
  nullifier: string
}

/**
 * Generate a ZKP proving age eligibility.
 * NOTE: In production this should run on the user's device, not the server.
 */
export async function generateAgeProof(input: AgeProofInput): Promise<AgeProofResult> {
  const { proof, publicSignals } = await groth16.fullProve(
    {
      birthYear: input.birthYear,
      salt: input.salt,
      currentYear: input.currentYear,
      ageThreshold: input.ageThreshold,
    },
    AGE_WASM,
    AGE_ZKEY,
  )

  const commitment = publicSignals[0] as string
  return { proof, publicSignals, commitment }
}

/**
 * Verify a Groth16 age proof.
 */
export async function verifyAgeProof(proof: unknown, publicSignals: string[]): Promise<boolean> {
  const vkey = loadVkey(AGE_VKEY)
  return groth16.verify(vkey, publicSignals, proof)
}

/**
 * Generate a ZKP proving age eligibility + nullifier for a community.
 * NOTE: In production this should run on the user's device, not the server.
 */
export async function generateNullifierProof(input: NullifierProofInput): Promise<NullifierProofResult> {
  const { proof, publicSignals } = await groth16.fullProve(
    {
      birthYear: input.birthYear,
      salt: input.salt,
      communityId: input.communityId,
      currentYear: input.currentYear,
      ageThreshold: input.ageThreshold,
    },
    NULL_WASM,
    NULL_ZKEY,
  )

  // publicSignals: [commitment, nullifier, communityId, currentYear, ageThreshold]
  const commitment = publicSignals[0] as string
  const nullifier = publicSignals[1] as string
  return { proof, publicSignals, commitment, nullifier }
}

/**
 * Verify a Groth16 nullifier proof.
 */
export async function verifyNullifierProof(proof: unknown, publicSignals: string[]): Promise<boolean> {
  const vkey = loadVkey(NULL_VKEY)
  return groth16.verify(vkey, publicSignals, proof)
}

/**
 * Compute the Poseidon commitment off-circuit.
 */
export async function computeCommitment(birthYear: number, salt: number): Promise<string> {
  const poseidon = await getPoseidon()
  const hash = poseidon([birthYear, salt])
  return poseidon.F.toString(hash)
}

/**
 * Compute the Poseidon nullifier off-circuit.
 */
export async function computeNullifier(salt: number, communityId: number): Promise<string> {
  const poseidon = await getPoseidon()
  const hash = poseidon([salt, communityId])
  return poseidon.F.toString(hash)
}
