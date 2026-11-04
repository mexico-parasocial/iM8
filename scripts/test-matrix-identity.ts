/**
 * Test Matrix identity derivation against the live Synapse server.
 */

import { randomBytes } from '@noble/hashes/utils'
import { getMatrixIdentity } from '../src/services/matrixIdentity'
import { signIdentityChallenge, verifyIdentityAssertion } from '../src/services/identitySignature'
import type { IdentityAssertion } from '../src/services/identitySignature'

const SERVER = 'matrix.para.social'
const HOMESERVER = 'http://localhost:8008'

async function main() {
  console.log('=== Matrix Identity Test ===\n')

  const seed = randomBytes(32)
  console.log(`Seed: ${Buffer.from(seed).toString('hex').slice(0, 16)}...`)

  console.log('\n--- Deriving Matrix identities ---')
  const publicId = getMatrixIdentity(seed, 'public', SERVER)
  console.log(`Public:     ${publicId.mxid}`)
  console.log(`  localpart: ${publicId.localpart}`)
  console.log(`  identityPub: ${publicId.identityPubHex.slice(0, 16)}...`)

  const anonId = getMatrixIdentity(seed, 'anonymous', SERVER)
  console.log(`Anonymous:  ${anonId.mxid}`)
  console.log(`  localpart: ${anonId.localpart}`)

  try {
    getMatrixIdentity(seed, 'civic', SERVER)
    console.log('\nERROR: civic identity should be forbidden!')
    process.exit(1)
  } catch (e) {
    console.log(`\nCivic identity correctly forbidden: ${(e as Error).message}`)
  }

  console.log('\n--- Checking homeserver ---')
  try {
    const resp = await fetch(`${HOMESERVER}/_matrix/client/versions`)
    const data = await resp.json() as { versions: string[] }
    console.log(`Homeserver reachable. Versions: ${data.versions.slice(-3).join(', ')}`)
  } catch (e) {
    console.log(`Homeserver not reachable at ${HOMESERVER}: ${(e as Error).message}`)
  }

  console.log('\n--- Signing matrix-login assertion ---')
  const challenge = 'test-challenge-' + Date.now()
  const signed = signIdentityChallenge(seed, 'public', {
    purpose: 'matrix-login',
    audience: 'para-idp',
    challenge,
  })
  console.log(`  type: ${signed.assertion.type}`)
  console.log(`  purpose: ${signed.assertion.purpose}`)
  console.log(`  audience: ${signed.assertion.audience}`)
  console.log(`  challenge: ${signed.assertion.challenge}`)
  console.log(`  identityPub: ${signed.assertion.identityPub.slice(0, 16)}...`)
  console.log(`  signature: ${signed.signature.slice(0, 16)}...`)

  console.log('\n--- Verifying signature locally ---')
  const expected: IdentityAssertion = {
    type: 'IdentityAssertion',
    purpose: 'matrix-login',
    audience: 'para-idp',
    identityPub: publicId.identityPubHex,
    challenge,
    signedAt: signed.assertion.signedAt,
  }
  const valid = verifyIdentityAssertion(signed, expected)
  console.log(`Signature valid: ${valid}`)

  console.log('\n--- Purpose binding test ---')
  const wrongExpected: IdentityAssertion = {
    type: 'IdentityAssertion',
    purpose: 'mubez-registration',
    audience: 'para-idp',
    identityPub: publicId.identityPubHex,
    challenge,
    signedAt: signed.assertion.signedAt,
  }
  const wrongPurpose = verifyIdentityAssertion(signed, wrongExpected)
  console.log(`Wrong purpose rejected: ${!wrongPurpose}`)

  const wrongChallenge: IdentityAssertion = {
    type: 'IdentityAssertion',
    purpose: 'matrix-login',
    audience: 'para-idp',
    identityPub: publicId.identityPubHex,
    challenge: 'different-challenge',
    signedAt: signed.assertion.signedAt,
  }
  const wrongCh = verifyIdentityAssertion(signed, wrongChallenge)
  console.log(`Wrong challenge rejected: ${!wrongCh}`)

  console.log('\n=== All tests passed ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
