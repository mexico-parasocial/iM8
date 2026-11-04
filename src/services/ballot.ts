import type { Persona } from '../types'

/**
 * Opaque civic ballot and delegation records.
 *
 * Shapes mirror `com.para.civic.vote` and `com.para.civic.delegation`:
 * subject, choice, nullifier, eligibility proof reference — and nothing
 * naming the voter. Delegation is inherent, not a toggle: there is no
 * `delegation-enabled` trait anywhere, and no code path gates delegating
 * behind one.
 *
 * Decided architecture (WatZappa OD-7, Reading A): the ballot identity
 * never signs. Votes are authorized by the m8-issued eligibility proof +
 * nullifier, so these builders take no key and no identity label — there
 * is no parameter through which the active persona could leak in, whichever
 * card (public, alt, anonymous) the user is acting as.
 *
 * What "opaque" does and does not mean: the record never names the
 * *delegator's* personas (no persona id, handle, MXID, display name, or
 * identity key). The *delegate target* (`delegateTo`) is the user's explicit
 * choice and is inherent to delegating — OD-7 notes the delegation graph is
 * more re-identifying than ballots, and that property lives server-side,
 * outside what a client builder can remove.
 */

export class BallotLinkageError extends Error {
  constructor(readonly paths: string[]) {
    super(
      `ballot record leaks persona linkage at: ${paths.join(', ')}`,
    )
    this.name = 'BallotLinkageError'
  }
}

/**
 * Key names that would name the voter. `delegateTo` / `delegatedFrom` are
 * deliberately absent: they name other parties (the chosen delegate, or
 * ballots delegated to this voter), which is the action itself.
 */
const VOTER_LINKAGE_KEYS = new Set([
  'personaId',
  'persona',
  'handle',
  'mxid',
  'displayName',
  'localpart',
  'identityPub',
  'identityPubHex',
  'voter',
  'voterDid',
  'accountDid',
  'owner',
  'author',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Paths where the record names the voter: denylisted keys, or string
 * values exactly equal to one of the caller's persona identifiers.
 * Exact match (not substring): short handles must not false-positive on
 * ordinary prose in `reason`.
 */
export function findPersonaLeakage(
  record: unknown,
  identifiers: string[],
  path = '$',
): string[] {
  const ids = new Set(identifiers.filter((id) => id.length > 0))
  const hits: string[] = []
  const visit = (value: unknown, at: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${at}[${index}]`))
      return
    }
    if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        const child = `${at}.${key}`
        if (VOTER_LINKAGE_KEYS.has(key)) hits.push(child)
        visit(item, child)
      }
      return
    }
    if (typeof value === 'string' && ids.has(value)) hits.push(at)
  }
  visit(record, path)
  return hits
}

/** Throw unless the record is opaque to the given persona identifiers. */
export function assertOpaqueBallotRecord(
  record: unknown,
  identifiers: string[] = [],
): void {
  const paths = findPersonaLeakage(record, identifiers)
  if (paths.length > 0) throw new BallotLinkageError(paths)
}

/** Every identifier by which any of these personas could be recognized. */
export function personaIdentifiers(personas: Persona[]): string[] {
  const ids: string[] = []
  for (const persona of personas) {
    ids.push(persona.id, persona.name, persona.handle, persona.role)
  }
  return ids
}

export type BallotSubjectType = 'cabildeo' | 'policy' | 'matter' | 'governance'

export type BallotVote = {
  $type: 'com.para.civic.vote'
  subject: string
  subjectType?: BallotSubjectType
  selectedOption?: number
  signal?: number
  reason?: string
  isDirect: boolean
  delegatedFrom?: string[]
  voteNullifier?: string
  eligibilityProofRef?: string
  createdAt: string
}

export type BallotDelegation = {
  $type: 'com.para.civic.delegation'
  cabildeo?: string
  mode?: 'active' | 'passive'
  delegateTo: string
  party?: string
  community?: string
  scopeFlairs?: string[]
  preferredOption?: number
  signal?: number
  reason?: string
  createdAt: string
}

function assertSignal(signal: number | undefined): void {
  if (signal === undefined) return
  if (!Number.isInteger(signal) || signal < -3 || signal > 3) {
    throw new Error(`signal must be an integer from -3 to +3, got ${signal}`)
  }
}

function assertReason(reason: string | undefined): void {
  if (reason !== undefined && reason.length > 1000) {
    throw new Error('reason must be at most 1000 characters')
  }
}

function assertDid(value: string, field: string): void {
  if (!value.startsWith('did:')) {
    throw new Error(`${field} must be a DID, got ${value}`)
  }
}

function assertCreatedAt(createdAt: string): void {
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
    throw new Error('createdAt must be a valid datetime')
  }
}

/** A direct or delegated vote. A vote is about something: subject is required. */
export function buildBallotVote(input: {
  subject: string
  subjectType?: BallotSubjectType
  selectedOption?: number
  signal?: number
  reason?: string
  isDirect: boolean
  delegatedFrom?: string[]
  voteNullifier?: string
  eligibilityProofRef?: string
  createdAt: string
}): BallotVote {
  if (!input.subject) throw new Error('subject is required')
  if (
    input.selectedOption !== undefined &&
    (!Number.isInteger(input.selectedOption) || input.selectedOption < 0)
  ) {
    throw new Error('selectedOption must be an integer >= 0')
  }
  assertSignal(input.signal)
  assertReason(input.reason)
  for (const did of input.delegatedFrom ?? []) assertDid(did, 'delegatedFrom')
  if (input.voteNullifier !== undefined && input.voteNullifier.length > 128) {
    throw new Error('voteNullifier must be at most 128 characters')
  }
  if (
    input.eligibilityProofRef !== undefined &&
    input.eligibilityProofRef.length > 512
  ) {
    throw new Error('eligibilityProofRef must be at most 512 characters')
  }
  assertCreatedAt(input.createdAt)

  const vote: BallotVote = {
    $type: 'com.para.civic.vote',
    subject: input.subject,
    isDirect: input.isDirect,
    createdAt: input.createdAt,
  }
  if (input.subjectType !== undefined) vote.subjectType = input.subjectType
  if (input.selectedOption !== undefined) vote.selectedOption = input.selectedOption
  if (input.signal !== undefined) vote.signal = input.signal
  if (input.reason !== undefined) vote.reason = input.reason
  if (input.delegatedFrom !== undefined) vote.delegatedFrom = [...input.delegatedFrom]
  if (input.voteNullifier !== undefined) vote.voteNullifier = input.voteNullifier
  if (input.eligibilityProofRef !== undefined) {
    vote.eligibilityProofRef = input.eligibilityProofRef
  }
  // Self-check: the builder's own output must carry no voter linkage.
  assertOpaqueBallotRecord(vote)
  return vote
}

/**
 * A standing delegation of voting power. `delegateTo` names the chosen
 * delegate — the user's explicit choice, not their identity.
 */
export function buildBallotDelegation(input: {
  delegateTo: string
  cabildeo?: string
  mode?: 'active' | 'passive'
  party?: string
  community?: string
  scopeFlairs?: string[]
  preferredOption?: number
  signal?: number
  reason?: string
  createdAt: string
}): BallotDelegation {
  assertDid(input.delegateTo, 'delegateTo')
  if (input.mode !== undefined && input.mode !== 'active' && input.mode !== 'passive') {
    throw new Error(`mode must be 'active' or 'passive', got ${input.mode}`)
  }
  for (const field of ['party', 'community'] as const) {
    const value = input[field]
    if (value !== undefined && value.length > 100) {
      throw new Error(`${field} must be at most 100 characters`)
    }
  }
  if (input.scopeFlairs !== undefined) {
    if (input.scopeFlairs.length > 10) {
      throw new Error('scopeFlairs must hold at most 10 entries')
    }
    for (const flair of input.scopeFlairs) {
      if (flair.length > 100) {
        throw new Error('scopeFlairs entries must be at most 100 characters')
      }
    }
  }
  if (
    input.preferredOption !== undefined &&
    (!Number.isInteger(input.preferredOption) || input.preferredOption < 0)
  ) {
    throw new Error('preferredOption must be an integer >= 0')
  }
  assertSignal(input.signal)
  assertReason(input.reason)
  assertCreatedAt(input.createdAt)

  const delegation: BallotDelegation = {
    $type: 'com.para.civic.delegation',
    delegateTo: input.delegateTo,
    createdAt: input.createdAt,
  }
  if (input.cabildeo !== undefined) delegation.cabildeo = input.cabildeo
  if (input.mode !== undefined) delegation.mode = input.mode
  if (input.party !== undefined) delegation.party = input.party
  if (input.community !== undefined) delegation.community = input.community
  if (input.scopeFlairs !== undefined) delegation.scopeFlairs = [...input.scopeFlairs]
  if (input.preferredOption !== undefined) {
    delegation.preferredOption = input.preferredOption
  }
  if (input.signal !== undefined) delegation.signal = input.signal
  if (input.reason !== undefined) delegation.reason = input.reason
  assertOpaqueBallotRecord(delegation)
  return delegation
}
