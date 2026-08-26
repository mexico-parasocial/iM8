import {
  facetRkey,
  facetSpaceFor,
  PROFILE_FACET_COLLECTION,
} from '../contracts/profileFacets'
import type { ProfileFacetRecord } from '../contracts/profileFacets'
import type { SpaceId } from '../contracts/spaceApi'
import type { Persona, Signal, SurfaceId } from '../types'

/**
 * Turns persona signal visibility into a publication plan for the Spaces
 * model. Pure and network-free: the plan is what Phase 3's credential-
 * authenticated client flushes as putRecord/deleteRecord writes, so the
 * mapping from "a badge the user tapped" to "which repo holds the item" lives
 * in exactly one place.
 *
 * Private items are deliberately absent from every outbound list — spaces are
 * access control, not encryption, so anything that must stay secret must
 * never be written to one.
 */

export type ProfilePublicationPlan = {
  space: SpaceId
  /** Items published to the public repo, world-readable. */
  publicItems: Signal[]
  /** Items written as facet records in the user's own space. */
  spaceItems: Signal[]
  /** Items that never leave this device. */
  privateItems: Signal[]
}

export function planProfilePublication(persona: Persona, authorityDid: string, surface?: SurfaceId): ProfilePublicationPlan {
  const space = facetSpaceFor(authorityDid)
  const publicItems: Signal[] = []
  const spaceItems: Signal[] = []
  const privateItems: Signal[] = []
  for (const signal of persona.signals) {
    // If a surface is specified, only include signals assigned to it
    if (surface && signal.surfaces && signal.surfaces.length > 0 && !signal.surfaces.includes(surface)) {
      continue
    }
    if (signal.visibility === 'Public') publicItems.push(signal)
    else if (signal.visibility === 'Trusted only') spaceItems.push(signal)
    else privateItems.push(signal)
  }
  return { space, publicItems, spaceItems, privateItems }
}

export function facetRecordFromSignal(signal: Signal, now: string): ProfileFacetRecord {
  return {
    $type: PROFILE_FACET_COLLECTION,
    label: signal.label,
    value: signal.value,
    updatedAt: now,
  }
}

export type FacetWriteOp =
  | { op: 'put'; rkey: string; record: ProfileFacetRecord }
  | { op: 'delete'; rkey: string }

function plannedRecords(signals: Signal[], now: string): Map<string, ProfileFacetRecord> {
  const records = new Map<string, ProfileFacetRecord>()
  for (const signal of signals) {
    if (signal.visibility !== 'Trusted only') continue
    records.set(facetRkey(signal.label), facetRecordFromSignal(signal, now))
  }
  return records
}

/**
 * Diffs two signal sets into the writes that bring the facet space in line:
 * puts for facets that are new or changed, deletes for facets that left the
 * space (visibility moved to Public, or the signal vanished). An unchanged
 * facet produces no write, so tapping badges around never spams the repo.
 */
export function diffFacetWrites(previous: Signal[], next: Signal[], now: string): FacetWriteOp[] {
  const before = plannedRecords(previous, now)
  const after = plannedRecords(next, now)
  const writes: FacetWriteOp[] = []

  for (const [rkey, record] of after) {
    const prior = before.get(rkey)
    if (!prior || prior.value !== record.value || prior.label !== record.label) {
      writes.push({ op: 'put', rkey, record })
    }
  }
  for (const rkey of before.keys()) {
    if (!after.has(rkey)) {
      writes.push({ op: 'delete', rkey })
    }
  }

  // Deterministic order keeps the outbox testable and idempotent-ish on retry.
  writes.sort((a, b) => a.rkey.localeCompare(b.rkey))
  return writes
}
