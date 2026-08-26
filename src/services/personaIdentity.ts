import type { IdentityLabel } from './keyDerivation'
import type { PersonaKind } from '../types'

/**
 * Persona → derived identity.
 *
 * This is the axis that actually carries keys, and it is worth being explicit
 * about why, because an earlier version of this module keyed off `SurfaceId`
 * instead and that was a category error. Surfaces (`public`, `civic`) describe
 * *where a persona is visible* — `Persona.surfaceStates` is
 * `Record<SurfaceId, SurfaceState>`, i.e. Live / Limited / Muted per context —
 * and the broker uses the same word to scope a grant. Neither of those signs
 * anything.
 *
 * The three derived labels correspond to roles, not places:
 *
 *   public     the named, linked identity (social accounts, public figure)
 *   civic      the private root: never displayed, enforces one-person-one-vote
 *              and backs civic eligibility proofs
 *   anonymous  the face shown in community contexts, carrying proofs without
 *              exposing the root behind them
 *
 * `civic` deliberately has no persona: a root that fronts a card is a root
 * that can be correlated with everything that card ever signed.
 */
export const PERSONA_IDENTITY: Record<PersonaKind, IdentityLabel> = {
  public: 'public',
  anonymous: 'anonymous',
}

export function identityForPersonaKind(kind: PersonaKind): IdentityLabel {
  return PERSONA_IDENTITY[kind]
}

/**
 * Which card index backs a given persona.
 *
 * A user may hold several anonymous cards, and the product tells them those
 * cards are not linked. That only holds if each card derives its own key —
 * sharing one key across cards would let anyone holding a signature from each
 * join them immediately. Card 0 is the label's primary identity.
 */
export interface PersonaKeyRef {
  label: IdentityLabel
  card: number
}

export function personaKeyRef(kind: PersonaKind, card = 0): PersonaKeyRef {
  if (!Number.isInteger(card) || card < 0) {
    throw new Error('card must be a non-negative integer')
  }
  return { label: identityForPersonaKind(kind), card }
}
