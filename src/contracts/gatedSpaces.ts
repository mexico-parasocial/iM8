import type { ProofBrokerClaimType } from './proofBroker'
import type { SimpleSpaceConfig, SpaceId } from './spaceApi'

/**
 * Proof-gated PARA spaces on the atproto Spaces alpha (proposal 0016).
 *
 * A gated space is an ordinary permissioned space whose authority defers the
 * admission decision to a managing app: `com.atproto.simplespace` config with
 * `policy: 'managing-app'`. The managing app is mubEZ, which answers
 * `com.atproto.simplespace.checkUserAccess` by checking the requesting DID's
 * proof artifacts — the same claims-not-profiles machinery the broker already
 * runs for app grants.
 *
 * Gate artifacts are broker proof artifacts minted with the *space URI* as
 * their audience, so a proof issued for one space cannot be replayed at
 * another. This replaces the dead `PermissionedSpace` type that sketched the
 * same idea pre-Spaces.
 */

/** The space types PARA runs; the NSID is also the consent boundary. */
export type GatedSpaceType =
  | 'com.para.space.civic'
  | 'com.para.space.regional'
  | 'com.para.space.topic'

export type GatedSpaceSpec = {
  spaceType: GatedSpaceType
  skey: string
  name: string
  detail: string
  requiredClaims: ProofBrokerClaimType[]
}

/**
 * The catalog iM8 ships. Authorities are per-community at runtime; this fixes
 * the modality, the skey convention, and what each gate demands.
 */
export const PARA_GATED_SPACES: readonly GatedSpaceSpec[] = [
  {
    spaceType: 'com.para.space.civic',
    skey: 'main',
    name: 'PARA space',
    detail: 'Deliberation for verified civic participants.',
    requiredClaims: ['is_civic_eligible', 'is_age_eligible'],
  },
  {
    spaceType: 'com.para.space.regional',
    skey: 'main',
    name: 'Regional space',
    detail: 'Regional threads gated on age eligibility.',
    requiredClaims: ['is_age_eligible'],
  },
  {
    spaceType: 'com.para.space.topic',
    skey: 'main',
    name: 'Topic space',
    detail: 'Topic rooms gated on PARA verification.',
    requiredClaims: ['has_para_verification'],
  },
]

/** The SpaceId for a catalog spec under a concrete community authority. */
export function gatedSpaceFor(spec: GatedSpaceSpec, authorityDid: string): SpaceId {
  return { authority: authorityDid, spaceType: spec.spaceType, skey: spec.skey }
}

/**
 * The simplespace configuration a community authority (or mubEZ on its
 * behalf) installs to turn a space into a proof-gated one.
 */
export function gatedSimpleSpaceConfig(spec: GatedSpaceSpec, managingAppDid: string): SimpleSpaceConfig {
  return {
    policy: 'managing-app',
    appAccess: { type: 'open' },
    managingApp: managingAppDid,
  }
}

/**
 * The audience mubEZ stamps on gate artifacts for a space. Identity today —
 * the space URI itself — but kept as a function so the convention is explicit
 * and greppable rather than an accident of string equality.
 */
export function gateAudienceFor(spaceUri: string): string {
  return spaceUri
}

/**
 * `com.atproto.simplespace.checkUserAccess`, served by the managing app
 * (mubEZ), not the PDS. Field names are provisional: the proposal specifies
 * the flow but not the payload, so treat this as PARA's proposal for it.
 */
export type CheckUserAccessRequest = {
  /** Space URI being asked about. */
  space: string
  /** DID of the user requesting a credential. */
  userDid: string
  /** Attested client_id, when the space gates on app identity. */
  clientId?: string
}

export type CheckUserAccessResponse = {
  authorized: boolean
  /** Machine-readable shortfall for denied requests, e.g. 'missing:is_age_eligible'. */
  reason?: string
}
