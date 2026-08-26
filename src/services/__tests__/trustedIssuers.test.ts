import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseTrustedIssuers, invalidTrustedIssuers } from '../trustedIssuers'

const keyA = 'a'.repeat(64)
const keyB = 'b'.repeat(64)

describe('trusted issuer configuration', () => {
  it('parses a comma-separated list', () => {
    assert.deepEqual(parseTrustedIssuers(`${keyA},${keyB}`), [keyA, keyB])
  })

  it('tolerates whitespace and normalises case', () => {
    assert.deepEqual(parseTrustedIssuers(`  ${keyA.toUpperCase()} , ${keyB} `), [keyA, keyB])
  })

  it('is empty when unset', () => {
    assert.deepEqual(parseTrustedIssuers(undefined), [])
    assert.deepEqual(parseTrustedIssuers(''), [])
  })

  it('drops malformed keys instead of trusting them', () => {
    // A truncated or mistyped key must never end up in the trust set: it would
    // silently widen what counts as a valid issuer.
    assert.deepEqual(parseTrustedIssuers(`${keyA},nope,${'c'.repeat(63)}`), [keyA])
  })

  it('reports what it dropped so misconfiguration is visible', () => {
    assert.deepEqual(invalidTrustedIssuers(`${keyA},nope`), ['nope'])
    assert.deepEqual(invalidTrustedIssuers(keyA), [])
  })
})
