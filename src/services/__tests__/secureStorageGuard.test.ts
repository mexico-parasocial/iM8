import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Regression test for the guard that decides whether a real keystore exists.
 *
 * The original check was `if (!SecureStore)`, i.e. "did the module load?". On
 * web, expo-secure-store resolves to `export default {}`: the require succeeds
 * and the module is truthy, so the check passed and the first real call died
 * with "setItemAsync is not a function" — instead of the clear, intended
 * SecureStoreUnavailableError. The guard has to probe the methods.
 *
 * The shapes below are duplicated rather than imported because the real module
 * closes over its detection at import time; this pins the *rule*.
 */
function isUsableStore(mod: unknown): boolean {
  const m = mod as Record<string, unknown> | null | undefined
  const candidate = (m?.setItemAsync ? m : (m?.default as typeof m)) as
    | Record<string, unknown>
    | undefined
  return (
    typeof candidate?.setItemAsync === 'function' &&
    typeof candidate?.getItemAsync === 'function' &&
    typeof candidate?.deleteItemAsync === 'function'
  )
}

const nativeModule = {
  setItemAsync: async () => {},
  getItemAsync: async () => null,
  deleteItemAsync: async () => {},
}

describe('secure store detection', () => {
  it('accepts a module that actually implements the calls', () => {
    assert.equal(isUsableStore(nativeModule), true)
  })

  it('rejects the web build, which is an empty default export', () => {
    // This is the exact shape that used to slip through.
    assert.equal(isUsableStore({ default: {} }), false)
    assert.equal(isUsableStore({}), false)
  })

  it('rejects a partially implemented module', () => {
    assert.equal(isUsableStore({ setItemAsync: async () => {} }), false)
  })

  it('rejects a missing module', () => {
    assert.equal(isUsableStore(null), false)
    assert.equal(isUsableStore(undefined), false)
  })

  it('unwraps an interop default export', () => {
    assert.equal(isUsableStore({ default: nativeModule }), true)
  })
})
