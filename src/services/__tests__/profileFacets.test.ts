import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  facetRkey,
  facetSpaceFor,
  profileFacetsScope,
  visibilityDestinationLabel,
  PROFILE_FACET_COLLECTION,
  PROFILE_FACETS_SPACE_SKEY,
  PROFILE_FACETS_SPACE_TYPE,
} from '../../contracts/profileFacets'
import {
  diffFacetWrites,
  facetRecordFromSignal,
  planProfilePublication,
} from '../profileFacets'
import { formatSpaceUri } from '../atproto/spaceClient'
import type { Persona, Signal } from '../../types'

const authorityDid = 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'

function signal(label: string, value: string, visibility: Signal['visibility']): Signal {
  return { label, value, visibility, action: 'Managed in Settings' }
}

function persona(signals: Signal[]): Persona {
  return {
    id: 'anon-card-1',
    name: 'Card',
    handle: '@card',
    role: 'Anonymous card',
    oneLine: '',
    summary: '',
    kind: 'anonymous',
    createdBy: 'bootstrap',
    surfaceStates: { public: 'Live', civic: 'Muted' },
    signals,
  }
}

const NOW = '2026-08-24T12:00:00Z'

describe('facet identifiers', () => {
  it('slugs signal labels into stable ASCII rkeys', () => {
    assert.equal(facetRkey('Cross-linking'), 'cross-linking')
    assert.equal(facetRkey('Años de residencia'), 'anos-de-residencia')
    assert.equal(facetRkey('  INE # '), 'ine')
  })

  it('anchors the facet space on the account DID with the reserved self skey', () => {
    const space = facetSpaceFor(authorityDid)
    assert.equal(space.spaceType, PROFILE_FACETS_SPACE_TYPE)
    assert.equal(space.skey, PROFILE_FACETS_SPACE_SKEY)
    assert.equal(
      formatSpaceUri(space),
      `at://${authorityDid}/space/${PROFILE_FACETS_SPACE_TYPE}/${PROFILE_FACETS_SPACE_SKEY}`
    )
  })

  it('builds the facet scope with self authority omitted', () => {
    assert.equal(
      profileFacetsScope(),
      `space:${PROFILE_FACETS_SPACE_TYPE}?skey=self&collection=${PROFILE_FACET_COLLECTION}`
    )
    assert.equal(
      profileFacetsScope(['create', 'update']),
      `space:${PROFILE_FACETS_SPACE_TYPE}?skey=self&collection=${PROFILE_FACET_COLLECTION}&action=create&action=update`
    )
  })

  it('labels the three destinations', () => {
    assert.equal(visibilityDestinationLabel('Public'), 'Public profile')
    assert.equal(visibilityDestinationLabel('Trusted only'), 'Facet space')
    assert.equal(visibilityDestinationLabel('Private'), 'This device only')
  })
})

describe('publication plan', () => {
  it('partitions signals into public, space, and device-only', () => {
    const plan = planProfilePublication(
      persona([
        signal('Display name', 'Moon', 'Public'),
        signal('Home state', 'CDMX', 'Trusted only'),
        signal('CURP', 'XEXX010101HNEXXXA4', 'Private'),
      ]),
      authorityDid
    )
    assert.deepEqual(plan.publicItems.map((item) => item.label), ['Display name'])
    assert.deepEqual(plan.spaceItems.map((item) => item.label), ['Home state'])
    assert.deepEqual(plan.privateItems.map((item) => item.label), ['CURP'])
    assert.equal(plan.space.authority, authorityDid)
  })

  it('builds facet records from signals', () => {
    const record = facetRecordFromSignal(signal('Home state', 'CDMX', 'Trusted only'), NOW)
    assert.deepEqual(record, {
      $type: PROFILE_FACET_COLLECTION,
      label: 'Home state',
      value: 'CDMX',
      updatedAt: NOW,
    })
  })
})

describe('facet write diff', () => {
  it('puts new and changed facets, deletes departed ones, skips unchanged', () => {
    const previous = [
      signal('Home state', 'CDMX', 'Trusted only'),
      signal('Display name', 'Moon', 'Public'),
      signal('Age range', '30–39', 'Trusted only'),
    ]
    const next = [
      signal('Home state', 'Jalisco', 'Trusted only'),
      signal('Display name', 'Moon', 'Public'),
      signal('Age range', '30–39', 'Private'),
      signal('Linked Instagram', '@moon', 'Trusted only'),
    ]
    assert.deepEqual(diffFacetWrites(previous, next, NOW), [
      { op: 'delete', rkey: 'age-range' },
      { op: 'put', rkey: 'home-state', record: facetRecordFromSignal(signal('Home state', 'Jalisco', 'Trusted only'), NOW) },
      { op: 'put', rkey: 'linked-instagram', record: facetRecordFromSignal(signal('Linked Instagram', '@moon', 'Trusted only'), NOW) },
    ])
  })

  it('emits nothing when nothing relevant changed', () => {
    const signals = [
      signal('Home state', 'CDMX', 'Trusted only'),
      signal('CURP', 'XEXX010101HNEXXXA4', 'Private'),
    ]
    assert.deepEqual(diffFacetWrites(signals, signals, NOW), [])
  })
})
