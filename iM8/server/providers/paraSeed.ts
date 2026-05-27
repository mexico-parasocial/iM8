import { access, readFile, stat } from 'node:fs/promises'

export type ParaSeedIdentity = {
  createdAt: string
  isVerifiedPublicFigure: boolean
  verifiedAt: string
  proofBlob: string
}

export type ParaSeedActor = {
  alias: string
  handle: string
  displayName: string
  description?: string
  roles?: string[]
  identity?: ParaSeedIdentity
}

export type ParaSeedVerificationRecord = {
  issuer: string
  subject: string
  rkey: string
  createdAt: string
}

export type ParaCivicSeedManifest = {
  seedId: string
  version: string
  actors: ParaSeedActor[]
  verificationRecords: ParaSeedVerificationRecord[]
}

type CachedManifest = {
  mtimeMs: number
  manifest: ParaCivicSeedManifest
}

export const DEFAULT_PARA_CIVIC_MANIFEST_PATHS = [
  '/Users/mlv/Desktop/master/mvp/PARA/scripts/civic-seed/manifest.v1.json',
  '/Users/mlv/Desktop/MASTER/PARA/scripts/civic-seed/manifest.v1.json',
  '/Users/mlv/Desktop/master/PARA/scripts/civic-seed/manifest.v1.json',
] as const

export const DEFAULT_PARA_CIVIC_MANIFEST_PATH = DEFAULT_PARA_CIVIC_MANIFEST_PATHS[0]

let cachedManifest: CachedManifest | null = null

function normalizeLookupKey(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function hasVerifierRole(actor: ParaSeedActor | undefined) {
  return toArray<string>(actor?.roles).includes('verifier')
}

export async function loadParaCivicSeedManifest(
  manifestPath = DEFAULT_PARA_CIVIC_MANIFEST_PATH
): Promise<ParaCivicSeedManifest> {
  const resolvedPath = await resolveManifestPath(manifestPath)
  const manifestStat = await stat(resolvedPath)

  if (cachedManifest?.mtimeMs === manifestStat.mtimeMs) {
    return cachedManifest.manifest
  }

  const raw = await readFile(resolvedPath, 'utf8')
  const parsed = JSON.parse(raw) as Partial<ParaCivicSeedManifest>

  const manifest: ParaCivicSeedManifest = {
    seedId: typeof parsed.seedId === 'string' ? parsed.seedId : 'para-civic-seed',
    version: typeof parsed.version === 'string' ? parsed.version : 'unknown',
    actors: toArray<ParaSeedActor>(parsed.actors),
    verificationRecords: toArray<ParaSeedVerificationRecord>(parsed.verificationRecords),
  }

  cachedManifest = {
    mtimeMs: manifestStat.mtimeMs,
    manifest,
  }

  return manifest
}

async function resolveManifestPath(manifestPath: string) {
  const candidates =
    manifestPath === DEFAULT_PARA_CIVIC_MANIFEST_PATH
      ? DEFAULT_PARA_CIVIC_MANIFEST_PATHS
      : [manifestPath]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return manifestPath
}

export function findSeedActor(
  manifest: ParaCivicSeedManifest,
  subject: string
): ParaSeedActor | undefined {
  const lookup = normalizeLookupKey(subject)

  return manifest.actors.find((actor) => {
    const candidateKeys = [actor.alias, actor.handle, actor.displayName].map(normalizeLookupKey)
    return candidateKeys.includes(lookup)
  })
}

export function findTrustedVerificationRecord(
  manifest: ParaCivicSeedManifest,
  subject: string
) {
  const actor = findSeedActor(manifest, subject)
  if (!actor) return null

  const record = manifest.verificationRecords.find((entry) => {
    if (normalizeLookupKey(entry.subject) !== normalizeLookupKey(actor.alias)) {
      return false
    }

    const issuer = findSeedActor(manifest, entry.issuer)
    return hasVerifierRole(issuer)
  })

  if (!record) return null

  return {
    record,
    issuer: findSeedActor(manifest, record.issuer) ?? null,
    subject: actor,
  }
}
