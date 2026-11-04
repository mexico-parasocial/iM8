import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { copyText } from '../clipboard'

describe('copyText', () => {
  it('reports success when the write resolves', async () => {
    let written: string | null = null
    const ok = await copyText(async (text) => {
      written = text
    }, 'did:example:123')
    assert.equal(ok, true)
    assert.equal(written, 'did:example:123')
  })

  it('reports failure when the write throws instead of claiming a copy', async () => {
    const ok = await copyText(async () => {
      throw new Error('no clipboard')
    }, 'did:example:123')
    assert.equal(ok, false)
  })

  it('accepts synchronous writers', async () => {
    const ok = await copyText(() => {}, 'did:example:123')
    assert.equal(ok, true)
  })
})
