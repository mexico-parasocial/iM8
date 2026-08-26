/**
 * Wire contract for the atproto Spaces alpha (proposal 0016, formerly the
 * "permissioned data" protocol).
 *
 * Modeled on the published proposal, not a ratified spec:
 * https://github.com/bluesky-social/proposals/tree/main/0016-permissioned-data
 * Field names below follow the proposal text; the alpha lexicons on the
 * implementation branch are still moving, so anything here may shift. Keep
 * this file free of runtime logic other than pure string building, so a
 * contract drift stays visible in one place.
 *
 * A space is an access boundary identified by (authority, spaceType, skey).
 * Records live in per-(user, space) repos on each member's own PDS. Reading
 * requires a space credential issued by the space authority and DPoP-bound to
 * the app holding it. Spaces provide access control, not confidentiality —
 * the PDS and any admitted app can read everything, so iM8's "raw data never
 * leaves the device" rule still applies to INE fields.
 */

/** A space authority, space type, or space key. DID / NSID / rkey-syntax strings. */
export type SpaceId = {
  /** DID at the root of the space; issues and signs space credentials. */
  authority: string
  /** NSID naming the space's modality; also the OAuth consent boundary. */
  spaceType: string
  /** Distinguishes spaces of the same type under the same authority. */
  skey: string
}

export type SpaceRecordRef = {
  collection: string
  rkey: string
}

/** Lifetime defaults from the proposal; authorities may differ. */
export const SPACE_DELEGATION_TOKEN_TTL_SECONDS = 60
export const SPACE_CREDENTIAL_TTL_SECONDS = 7200

/**
 * Decoded claims of the JWT classes in the credential flow. iM8 only ever
 * *consumes* delegation tokens (the user's PDS mints them), so their type is
 * documentation for stubs and tests; space credentials are parsed and
 * binding-checked in services/atproto/spaceClient.ts.
 */

export type SpaceDelegationTokenClaims = {
  /** User DID delegating to the app. */
  iss: string
  /** Space URI being requested. */
  sub: string
  /** Space host service id (authority DID + fragment). */
  aud: string
  iat: number
  exp: number
  jti: string
}

export type SpaceCredentialClaims = {
  /** Space authority DID that signed the credential. */
  iss: string
  /** Space URI the credential reads. */
  sub: string
  /** JWK thumbprint (RFC 7638) of the DPoP key the credential is bound to. */
  cnf: { jkt: string }
  iat: number
  exp: number
  jti: string
}

export type SpaceClientAttestationClaims = {
  /** The app's client_id (its client-metadata.json URL). iss == sub. */
  iss: string
  sub: string
  /** Space host being asked for a credential. */
  aud: string
  iat: number
  exp: number
  jti: string
}

export type DPoPProofClaims = {
  jti: string
  /** HTTP method of the request the proof accompanies. */
  htm: string
  /** HTTP URI of the request, without query or fragment. */
  htu: string
  iat: number
  /** Access-token hash; present when accompanying a token, absent for grants. */
  ath?: string
}

/**
 * XRPC surface of the credential flow. The repo/sync queries (getRepo,
 * listRepoOps, getBlob, …) take a space credential plus a DPoP proof via
 * credentialAuthHeaders; the delegation-token call rides the app's OAuth
 * session with the user's PDS.
 */
export type GetDelegationTokenOutput = {
  delegationToken: string
}

export type GetSpaceCredentialInput = {
  delegationToken: string
  clientAttestation?: string
}

export type GetSpaceCredentialOutput = {
  credential: string
}

export type SpaceRepoStatus = {
  did: string
  rev: string
  /** Commit set-hash digest, hex. */
  hash: string
}

export type ListReposOutput = {
  repos: SpaceRepoStatus[]
}

/**
 * Record writes into the caller's own permissioned repo. Field names follow
 * the proposal; confirm against the alpha lexicons before pointing these at a
 * live PDS.
 */
export type SpaceCreateRecordInput = {
  space: SpaceId
  collection: string
  rkey?: string
  record: Record<string, unknown>
}

export type SpacePutRecordInput = {
  space: SpaceId
  collection: string
  rkey: string
  record: Record<string, unknown>
}

export type SpaceDeleteRecordInput = {
  space: SpaceId
  collection: string
  rkey: string
}

export type SpaceListSpacesOutput = {
  spaces: SpaceId[]
}

/**
 * `com.atproto.simplespace`: the space-management implementation every PDS
 * must support. iM8's proof-gated spaces (Phase 3) use `policy:
 * 'managing-app'` with mubEZ as the managing app answering checkUserAccess.
 */
export type SimpleSpacePolicy = 'member-list' | 'public' | 'managing-app'

export type SimpleSpaceAppAccess =
  | { type: 'open' }
  | { type: 'allowList'; allowed: string[] }

export type SimpleSpaceConfig = {
  policy: SimpleSpacePolicy
  appAccess: SimpleSpaceAppAccess
  /** DID + fragment routing checkUserAccess; required for managing-app. */
  managingApp?: string
}

export type CreateSimpleSpaceInput = {
  spaceType: string
  skey: string
  config?: Partial<SimpleSpaceConfig>
}

export type SimpleSpaceMember = {
  did: string
  addedAt?: string
}

export type ListSimpleSpaceMembersOutput = {
  members: SimpleSpaceMember[]
}

/** Provisional: only SpaceDeleted is named in the proposal so far. */
export type SpaceXrpcErrorName =
  | 'SpaceDeleted'
  | 'ExpiredToken'
  | 'InvalidToken'
  | 'InvalidRequest'
  | 'Unauthorized'

export type SpaceScopeAction = 'read_self' | 'read' | 'create' | 'update' | 'delete'
export type SpaceScopeManageOp = 'create' | 'update' | 'delete'

export type SpaceScopeInput = {
  /** Space-type NSID, or '*' for any type (standalone scopes only). */
  spaceType: string
  /** DID, 'self' (default, omitted from the string), or '*'. */
  authority?: string
  /** Defaults to '*'. */
  skey?: string
  /** Collections the grant may write; omit for the type's declared default. */
  collections?: string[]
  /** Record actions; omit for the full set (read/create/update/delete). */
  actions?: SpaceScopeAction[]
  /** Space-management verbs; omit for none. */
  manage?: SpaceScopeManageOp[]
}

/**
 * Builds a `space:` OAuth scope per proposal 0016:
 *
 *   space:<spaceType>[?authority=<did>][&skey=<skey>][&collection=<nsid>...]
 *                                       [&action=<action>...][&manage=<op>...]
 *
 * Defaults follow the proposal: authority 'self' and skey '*' are omitted
 * (self is the documented default, and omitted actions mean full record
 * access). Parameter order matches the grammar so strings are stable for
 * pinning and comparison.
 */
export function buildSpaceScope(input: SpaceScopeInput): string {
  const parts: string[] = []

  const authority = input.authority ?? 'self'
  if (authority !== 'self') {
    parts.push(`authority=${authority}`)
  }

  const skey = input.skey ?? '*'
  if (skey !== '*') {
    parts.push(`skey=${skey}`)
  }

  for (const collection of input.collections ?? []) {
    parts.push(`collection=${collection}`)
  }

  for (const action of input.actions ?? []) {
    parts.push(`action=${action}`)
  }

  for (const op of input.manage ?? []) {
    parts.push(`manage=${op}`)
  }

  const query = parts.join('&')
  return query ? `space:${input.spaceType}?${query}` : `space:${input.spaceType}`
}
