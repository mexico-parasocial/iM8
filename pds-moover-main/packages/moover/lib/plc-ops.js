/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 * @typedef {import('@atcute/did-plc').defs} defs
 * @typedef {import('@atcute/did-plc').normalizeOp} normalizeOp
 * @typedef {import('@atcute/did-plc').Operation} Operation
 * @typedef {import('@atcute/did-plc').CompatibleOperation} CompatibleOperation
 * @typedef {import('@atcute/did-plc').IndexedEntryLog} IndexedEntryLog
 * @typedef {import('@atcute/did-plc').IndexedEntry} IndexedEntry
 */

import { defs, normalizeOp } from '@atcute/did-plc'
import {
  P256PrivateKey,
  parsePrivateMultikey,
  Secp256k1PrivateKey,
  Secp256k1PrivateKeyExportable,
} from '@atcute/crypto'
import * as CBOR from '@atcute/cbor'
import { fromBase16, toBase64Url } from '@atcute/multibase'

// Helper to base64url-encode JSON
const jsonToB64Url = obj => {
  const enc = new TextEncoder()
  const json = JSON.stringify(obj)
  return toBase64Url(enc.encode(json))
}

/**
 * Class to help with various PLC operations
 */
class PlcOps {
  /**
   *
   * @param plcDirectoryUrl {string} - The url of the plc directory, defaults to https://plc.directory
   */
  constructor(plcDirectoryUrl = 'https://plc.directory') {
    /**
     * The url of the plc directory
     * @type {string}
     */
    this.plcDirectoryUrl = plcDirectoryUrl
  }

  /**
   *  Gets the current rotation keys for a user via their last PlC operation
   * @param did
   * @returns {Promise<string[]>}
   */
  async getCurrentRotationKeysForUser(did) {
    const logs = await this.getPlcAuditLogs(did)
    const { lastOperation } = this.getLastPlcOp(logs)
    return lastOperation.rotationKeys || []
  }

  /**
   *  Gets the last PlC operation for a user from the plc directory
   * @param did
   * @returns {Promise<{lastOperation: Operation, base: any}>}
   */
  async getLastPlcOpFromPlc(did) {
    const logs = await this.getPlcAuditLogs(did)
    return this.getLastPlcOp(logs)
  }

  /**
   *
   * @param logs {IndexedEntryLog}
   * @returns {{lastOperation: Operation, base: IndexedEntry}}
   */
  getLastPlcOp(logs) {
    const lastOp = logs.at(-1)
    return { lastOperation: normalizeOp(lastOp.operation), base: lastOp }
  }

  /**
   *  Gets the plc audit logs for a user from the plc directory
   * @param did
   * @returns {Promise<IndexedEntryLog>}
   */
  async getPlcAuditLogs(did) {
    const response = await fetch(`${this.plcDirectoryUrl}/${did}/log/audit`)
    if (!response.ok) {
      throw new Error(`got response ${response.status}`)
    }

    const json = await response.json()
    return defs.indexedEntryLog.parse(json)
  }

  /**
   * Creates a new secp256k1 key that can be used for either rotation or verification key
   * @returns {Promise<{privateKey: string, publicKey: `did:key:${string}`}>}
   */
  async createANewSecp256k1() {
    let keypair = await Secp256k1PrivateKeyExportable.createKeypair()
    let publicKey = await keypair.exportPublicKey('did')
    let privateKey = await keypair.exportPrivateKey('multikey')
    return {
      privateKey,
      publicKey,
    }
  }

  /**
   * Signs a new operation with the provided signing key, and information and submits it to the plc directory
   * @param did {string} - The user's did
   * @param signingRotationKey { P256PrivateKey|Secp256k1PrivateKey} - The keypair to sign the op with
   * @param alsoKnownAs {string[]}
   * @param rotationKeys {string[]}
   * @param pds {string}
   * @param verificationKey {string} - The public verification key
   * @param prev {string} - The previous valid operation's cid.
   * @returns {Promise<void>}
   */
  async signAndPublishNewOp(
    did,
    signingRotationKey,
    alsoKnownAs,
    rotationKeys,
    pds,
    verificationKey,
    prev,
  ) {
    const rotationKeysToUse = [...new Set(rotationKeys)]
    if (!rotationKeysToUse) {
      throw new Error('No rotation keys were found to be added to the PLC')
    }

    if (rotationKeysToUse.length > 5) {
      throw new Error('You can only add up to 5 rotation keys to the PLC')
    }

    const operation = {
      type: 'plc_operation',
      prev,
      alsoKnownAs,
      rotationKeys: rotationKeysToUse,
      services: {
        atproto_pds: {
          type: 'AtprotoPersonalDataServer',
          endpoint: pds,
        },
      },
      verificationMethods: {
        atproto: verificationKey,
      },
    }
    const opBytes = CBOR.encode(operation)
    const sigBytes = await signingRotationKey.sign(opBytes)

    const signature = toBase64Url(sigBytes)

    const signedOperation = {
      ...operation,
      sig: signature,
    }

    await this.pushPlcOperation(did, signedOperation)
  }

  /**
   * Takes a multi or hex based private key and returns a keypair
   * @param privateKeyString {string}
   * @param type {string} - secp256k1 or p256, needed if the private key is hex based, can be assumed if it's a multikey
   * @returns {Promise<{type: string, didPublicKey: `did:key:${string}`, keypair: P256PrivateKey|Secp256k1PrivateKey}>}
   */
  async getKeyPair(privateKeyString, type = 'secp256k1') {
    const HEX_REGEX = /^[0-9a-f]+$/i
    const MULTIKEY_REGEX = /^z[a-km-zA-HJ-NP-Z1-9]+$/
    let keypair = undefined

    if (HEX_REGEX.test(privateKeyString)) {
      const privateKeyBytes = fromBase16(privateKeyString)

      switch (type) {
        case 'p256': {
          keypair = await P256PrivateKey.importRaw(privateKeyBytes)
          break
        }
        case 'secp256k1': {
          keypair = await Secp256k1PrivateKey.importRaw(privateKeyBytes)
          break
        }
        default: {
          throw new Error(`unsupported "${type}" type`)
        }
      }
    } else if (MULTIKEY_REGEX.test(privateKeyString)) {
      const match = parsePrivateMultikey(privateKeyString)
      const privateKeyBytes = match.privateKeyBytes

      switch (match.type) {
        case 'p256': {
          keypair = await P256PrivateKey.importRaw(privateKeyBytes)
          console.log(keypair)
          break
        }
        case 'secp256k1': {
          keypair = await Secp256k1PrivateKey.importRaw(privateKeyBytes)
          break
        }
        default: {
          throw new Error(`unsupported "${type}" type`)
        }
      }
    } else {
      throw new Error('unknown input format')
    }
    return {
      type: 'private_key',
      didPublicKey: await keypair.exportPublicKey('did'),
      keypair: keypair,
    }
  }

  /**
   * Submits a new operation to the plc directory
   * @param did {string} - The user's did
   * @param operation
   * @returns {Promise<void>}
   */
  async pushPlcOperation(did, operation) {
    const response = await fetch(`${this.plcDirectoryUrl}/${did}`, {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(operation),
    })

    const headers = response.headers
    if (!response.ok) {
      const type = headers.get('content-type')

      if (type?.includes('application/json')) {
        const json = await response.json()
        if (typeof json === 'object' && json !== null && typeof json.message === 'string') {
          throw new Error(json.message)
        }
      }

      throw new Error(`got http ${response.status} from plc`)
    }
  }

  /**
   * Creates a new service auth token for a user. This is what is used to create a new account on a PDS for your did
   *
   * @param iss The user's did
   * @param aud The did:web, if it's a PDS it's usually from /xrpc/com.atproto.server.describeServer
   * @param keypair The keypair to sign with only supporting ES256K atm
   * @param lxm The lxm which is usually com.atproto.server.createAccount for creating a new account
   * @returns {Promise<string>}
   */
  async createANewServiceAuthToken(iss, aud, keypair, lxm) {
    // Compute iat/exp defaults (60s window like reference: MINUTE/1e3)
    const iat = Math.floor(Date.now() / 1e3)
    const exp = iat + 60

    // Generate a 16-byte hex jti
    const jti = (() => {
      const bytes = new Uint8Array(16)
      // crypto in browser or node; fall back safely
      ;(globalThis.crypto || window.crypto).getRandomValues(bytes)
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    })()

    // Build header and payload (omit undefined fields)
    // Just defaulting to ES256K since p256 was not importing on firefox
    const header = { typ: 'JWT', alg: 'ES256K' }
    const payload = {}
    payload.iat = iat
    payload.iss = iss
    payload.aud = aud
    payload.exp = exp
    payload.lxm = lxm
    payload.jti = jti

    const headerB64 = jsonToB64Url(header)
    const payloadB64 = jsonToB64Url(payload)
    const toSignStr = `${headerB64}.${payloadB64}`

    // Sign
    const toSignBytes = new TextEncoder().encode(toSignStr)
    const sigBytes = await keypair.sign(toSignBytes)

    // Return compact JWS
    const sigB64 = toBase64Url(sigBytes)
    return `${toSignStr}.${sigB64}`
  }
}

export { PlcOps }
