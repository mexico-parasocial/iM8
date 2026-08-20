import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hexToBytes, bytesToHex, numberToBytesLE } from '@noble/curves/abstract/utils'
import {
  deriveMasterKeys,
  deriveAllIdentities,
  mnemonicToSeed,
  seedToMnemonic,
  isValidMnemonic,
  IDENTITY_INDEXES,
  type IdentityLabel,
} from '../keyDerivation'

/*
 * The vectors are the shared contract with mubEZ (the file is a copy of
 * mubEZ/docs/identity-derivation-vectors.json). If this test fails after a
 * change here, the client has drifted from the spec - fix the code, never the
 * vectors.
 */
const vectorsFile = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'identity-derivation-vectors.json'),
    'utf8',
  ),
)

describe('keyDerivation matches the shared spec vectors', () => {
  it('reproduces master keys and all identity keys byte for byte', () => {
    for (const vector of vectorsFile.vectors) {
      const seed = hexToBytes(vector.seed)
      const keys = deriveMasterKeys(seed)
      assert.equal(bytesToHex(numberToBytesLE(keys.spendPriv, 32)), vector.spendPriv)
      assert.equal(bytesToHex(numberToBytesLE(keys.viewPriv, 32)), vector.viewPriv)
      assert.equal(bytesToHex(keys.spendPub), vector.spendPub)

      const identities = deriveAllIdentities(seed)
      for (const expected of vector.identities) {
        const label = expected.label as IdentityLabel
        assert.equal(IDENTITY_INDEXES[label], expected.index)
        assert.equal(bytesToHex(numberToBytesLE(identities[label].priv, 32)), expected.priv)
        assert.equal(identities[label].pubHex, expected.pub)
      }
    }
  })

  it('round-trips seed through the 24-word backup mnemonic', () => {
    for (const vector of vectorsFile.vectors) {
      const seed = hexToBytes(vector.seed)
      const mnemonic = seedToMnemonic(seed)
      assert.equal(mnemonic.split(' ').length, 24)
      assert.deepEqual(mnemonicToSeed(mnemonic), seed)
    }
  })

  it('accepts sloppy mnemonic input (case, spacing) but rejects bad checksums', () => {
    const mnemonic = seedToMnemonic(hexToBytes(vectorsFile.vectors[0].seed))
    const sloppy = `  ${mnemonic.toUpperCase().split(' ').join('   ')} `
    assert.deepEqual(mnemonicToSeed(sloppy), hexToBytes(vectorsFile.vectors[0].seed))

    const words = mnemonic.split(' ')
    words[23] = words[23] === 'abandon' ? 'ability' : 'abandon'
    assert.equal(isValidMnemonic(words.join(' ')), false)
  })

  it('rejects mnemonics that are valid BIP-39 but not 32 bytes of entropy', () => {
    // 12 words = 16 bytes of entropy: valid BIP-39, wrong size for our seed.
    const twelve =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    assert.equal(isValidMnemonic(twelve), false)
    assert.throws(() => mnemonicToSeed(twelve), /32-byte seed/)
  })
})
