import { buildSpaceScope } from './spaceApi'
import type { SpaceId, SpaceScopeAction } from './spaceApi'
import type { Visibility } from '../types'

/**
 * PARA profile facets on the atproto Spaces model (proposal 0016).
 *
 * A persona's `Signal.visibility` decides where the item lives:
 *   Public      → the user's public repo, world-readable as today
 *   Trusted only→ a permissioned space on the user's own authority, readable
 *                 only by whoever the user admits (or a proof gate admits)
 *   Private     → this device only; never written anywhere, because spaces
 *                 provide access control, not confidentiality
 *
 * The facet space is a single space per account: authority is the account's
 * own DID, skey is the proposal's reserved `self`.
 */

export const PROFILE_FACETS_SPACE_TYPE = 'im8.para.profileFacets'
export const PROFILE_FACET_COLLECTION = 'im8.para.profileFacet'
export const PROFILE_FACETS_SPACE_SKEY = 'self'

/**
 * The space type declaration iM8 publishes when it registers the namespace.
 * Kept in code as the single source the consent-screen name (`name`) and
 * default collection set are read from — the space type is the OAuth consent
 * boundary, so its wording is user-facing.
 */
export const profileFacetsSpaceDeclaration = {
  lexicon: 1,
  id: PROFILE_FACETS_SPACE_TYPE,
  defs: {
    main: {
      type: 'space',
      description: 'Scoped profile facets for PARA personas',
      key: 'any',
      name: 'PARA Profile Facets',
      'name:lang': { es: 'Facetas de perfil PARA' },
      collections: [PROFILE_FACET_COLLECTION],
    },
  },
} as const

/** Record shape inside the facet space's collection. */
export type ProfileFacetRecord = {
  $type: typeof PROFILE_FACET_COLLECTION
  /** Signal label, kept verbatim so the facet renders without a lookup. */
  label: string
  value: string
  updatedAt: string
}

/** The user's own facet space; `self`-anchored, so the authority is the DID. */
export function facetSpaceFor(authorityDid: string): SpaceId {
  return {
    authority: authorityDid,
    spaceType: PROFILE_FACETS_SPACE_TYPE,
    skey: PROFILE_FACETS_SPACE_SKEY,
  }
}

/**
 * Stable rkey for a signal: a slug of its label. Rkeys are limited to ASCII,
 * so accents are stripped rather than percent-encoded.
 */
export function facetRkey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The OAuth scope iM8 requests for facet writes. Authority defaults to self,
 * which is exactly the facet space's anchor.
 */
export function profileFacetsScope(actions?: SpaceScopeAction[]): string {
  return buildSpaceScope({
    spaceType: PROFILE_FACETS_SPACE_TYPE,
    skey: PROFILE_FACETS_SPACE_SKEY,
    collections: [PROFILE_FACET_COLLECTION],
    actions,
  })
}

export function visibilityDestinationLabel(visibility: Visibility): string {
  if (visibility === 'Public') return 'Public profile'
  if (visibility === 'Trusted only') return 'Facet space'
  return 'This device only'
}
