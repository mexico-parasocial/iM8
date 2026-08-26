import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha256'

import { buildSpaceScope } from '../../contracts/spaceApi'
import type { SpaceId } from '../../contracts/spaceApi'
import {
  createClientAttestation,
  createDPoPKey,
  createDPoPProof,
  credentialAuthHeaders,
  credentialNeedsRefresh,
  decodeJwt,
  formatSpaceRecordUri,
  formatSpaceUri,
  jwkThumbprint,
  newJti,
  obtainSpaceCredential,
  parseSpaceCredential,
  parseSpaceUri,
  signEs256Jwt,
} from '../atproto/spaceClient'

// Fixed P-256 scalars, far below the curve order. Throwaway test keys playing
// the app's DPoP key and the space authority.
const appPrivateKey = new Uint8Array(32).fill(0x2a)
const appKey = createDPoPKey((length) => new Uint8Array(length).fill(0x2a))
assert.equal(Buffer.from(appKey.privateKey).toString('hex'), Buffer.from(appPrivateKey).toString('hex'))

// The space and timestamps from proposal 0016's worked examples.
const space: SpaceId = {
  authority: 'did:example:space_did',
  spaceType: 'com.example.space_type',
  skey: 'space_key',
}
const spaceUri = 'at://did:example:space_did/space/com.example.space_type/space_key'
const IAT = 1738368000
const EXP = 1738375200 // iat + 7200

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBytes(text: string): Uint8Array {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Verifies the ES256 signature of a compact JWT against a raw public key. */
function jwtSignatureValid(jwt: string, publicKey: Uint8Array): boolean {
  const [h, p, s] = jwt.split('.')
  return p256.verify(b64urlToBytes(s), sha256(new TextEncoder().encode(`${h}.${p}`)), publicKey)
}

function pubFromJwk(jwk: { x: string; y: string }): Uint8Array {
  return new Uint8Array([0x04, ...b64urlToBytes(jwk.x), ...b64urlToBytes(jwk.y)])
}

function mintCredential(claims: Record<string, unknown>, kid = '#atproto_space'): string {
  return signEs256Jwt(
    new Uint8Array(32).fill(0x3b),
    { typ: 'atproto-space-credential+jwt', alg: 'ES256', kid },
    claims
  )
}

const specJkt = '0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I'

function mintSpecShapedCredential(overrides: Record<string, unknown> = {}): string {
  return mintCredential({
    iss: 'did:example:space_did',
    sub: spaceUri,
    cnf: { jkt: appKey.jkt },
    iat: IAT,
    exp: EXP,
    jti: '9f8e7d6c5b4a3210fedcba9876543210',
    ...overrides,
  })
}

describe('jwk thumbprint (RFC 7638)', () => {
  it('matches the RFC 7638 §3.1 published vector', () => {
    // Canonicalization check: required members only, lexicographic order, no
    // whitespace. JWK quoted from the RFC's RSA example.
    const jwk = {
      kty: 'RSA',
      n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
      e: 'AQAB',
      alg: 'RS256',
      kid: '2011-04-29',
    }
    assert.equal(jwkThumbprint(jwk), 'NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs')
  })

  it('ignores member insertion order for EC keys', () => {
    const a = jwkThumbprint({ kty: 'EC', crv: 'P-256', x: appKey.jwk.x, y: appKey.jwk.y })
    const b = jwkThumbprint({ y: appKey.jwk.y, crv: 'P-256', x: appKey.jwk.x, kty: 'EC' })
    assert.equal(a, b)
  })
})

describe('space OAuth scopes (proposal 0016 examples)', () => {
  it('builds every published example scope', () => {
    assert.equal(buildSpaceScope({ spaceType: 'com.example.bookmarks' }), 'space:com.example.bookmarks')
    assert.equal(
      buildSpaceScope({ spaceType: 'com.atmoboards.forum', authority: '*' }),
      'space:com.atmoboards.forum?authority=*'
    )
    assert.equal(
      buildSpaceScope({ spaceType: 'com.atmoboards.forum', authority: '*', actions: ['read'] }),
      'space:com.atmoboards.forum?authority=*&action=read'
    )
    assert.equal(
      buildSpaceScope({
        spaceType: 'com.atmoboards.forum',
        authority: '*',
        actions: ['read_self'],
      }),
      'space:com.atmoboards.forum?authority=*&action=read_self'
    )
    assert.equal(
      buildSpaceScope({
        spaceType: 'com.atmoboards.forum',
        authority: '*',
        collections: ['*'],
      }),
      'space:com.atmoboards.forum?authority=*&collection=*'
    )
    assert.equal(
      buildSpaceScope({
        spaceType: 'com.atmoboards.forum',
        authority: 'did:plc:abc123',
        skey: 'default',
        collections: ['com.atmoboards.thread'],
        actions: ['create', 'update'],
      }),
      'space:com.atmoboards.forum?authority=did:plc:abc123&skey=default&collection=com.atmoboards.thread&action=create&action=update'
    )
    assert.equal(
      buildSpaceScope({
        spaceType: 'com.atmoboards.forum',
        authority: '*',
        actions: ['read_self'],
        manage: ['update', 'delete'],
      }),
      'space:com.atmoboards.forum?authority=*&action=read_self&manage=update&manage=delete'
    )
    assert.equal(
      buildSpaceScope({
        spaceType: 'com.atmoboards.forum',
        authority: '*',
        manage: ['update', 'delete'],
      }),
      'space:com.atmoboards.forum?authority=*&manage=update&manage=delete'
    )
    assert.equal(
      buildSpaceScope({ spaceType: '*', authority: 'did:plc:abc123' }),
      'space:*?authority=did:plc:abc123'
    )
  })

  it('omits the self authority and wildcard skey defaults', () => {
    assert.equal(
      buildSpaceScope({ spaceType: 'com.example.bookmarks', authority: 'self', skey: '*' }),
      'space:com.example.bookmarks'
    )
  })
})

describe('space URIs', () => {
  it('formats the proposal example space URI', () => {
    assert.equal(formatSpaceUri(space), spaceUri)
  })

  it('round-trips space and record URIs', () => {
    assert.deepEqual(parseSpaceUri(spaceUri), { kind: 'space', id: space })
    const recordUri = formatSpaceRecordUri(space, {
      did: 'did:plc:author',
      collection: 'im8.para.profileFacet',
      rkey: 'self',
    })
    assert.equal(recordUri, `${spaceUri}/did:plc:author/im8.para.profileFacet/self`)
    assert.deepEqual(parseSpaceUri(recordUri), {
      kind: 'record',
      id: space,
      authorDid: 'did:plc:author',
      collection: 'im8.para.profileFacet',
      rkey: 'self',
    })
  })

  it('rejects public at:// URIs, which never carry the space marker', () => {
    assert.equal(parseSpaceUri('at://did:plc:abc/app.bsky.feed.post/3lb3kc2k'), null)
    assert.equal(parseSpaceUri('at://did:plc:abc/space/type'), null)
    assert.equal(parseSpaceUri('https://example.com'), null)
  })
})

describe('DPoP proofs (RFC 9449)', () => {
  it('signs a proof whose embedded jwk verifies the signature', () => {
    const proof = createDPoPProof(appKey, {
      htm: 'POST',
      htu: 'https://space.example.com/xrpc/com.atproto.space.getSpaceCredential',
      now: IAT,
      jti: 'e1c4a986c37d4f60a31c9c04e50b7ea5',
    })
    const decoded = decodeJwt(proof)
    if (decoded === null) throw new Error('proof did not decode')
    assert.equal(decoded.header.typ, 'dpop+jwt')
    assert.equal(decoded.header.alg, 'ES256')
    assert.deepEqual(decoded.header.jwk, appKey.jwk)
    assert.deepEqual(decoded.payload, {
      jti: 'e1c4a986c37d4f60a31c9c04e50b7ea5',
      htm: 'POST',
      htu: 'https://space.example.com/xrpc/com.atproto.space.getSpaceCredential',
      iat: IAT,
    })
    assert.ok(jwtSignatureValid(proof, pubFromJwk(appKey.jwk)))
  })

  it('binds the access-token hash when accompanying a credential', () => {
    const credential = mintSpecShapedCredential()
    const proof = createDPoPProof(appKey, {
      htm: 'GET',
      htu: 'https://pds.example.com/xrpc/com.atproto.space.getRepo',
      now: IAT,
      jti: 'j1',
      accessToken: credential,
    })
    const decoded = decodeJwt(proof)
    if (decoded === null) throw new Error('decode failed')
    assert.equal(decoded.payload.ath, b64url(sha256(new TextEncoder().encode(credential))))
  })

  it('omits ath for authorization-grant proofs', () => {
    const proof = createDPoPProof(appKey, {
      htm: 'POST',
      htu: 'https://space.example.com/xrpc/com.atproto.space.getSpaceCredential',
      now: IAT,
      jti: 'j2',
    })
    assert.equal(decodeJwt(proof)?.payload.ath, undefined)
  })
})

describe('delegation tokens and client attestations', () => {
  it('encodes the proposal example delegation-token claims', () => {
    const token = signEs256Jwt(
      appPrivateKey,
      { typ: 'atproto-space-delegation+jwt', alg: 'ES256K', kid: '#atproto' },
      {
        iss: 'did:example:user_did',
        sub: spaceUri,
        aud: 'did:example:space_did#atproto_space_host',
        iat: IAT,
        exp: IAT + 60,
        jti: 'f47ac10b58cc4372a5670e02b2c3d479',
      }
    )
    const decoded = decodeJwt(token)
    if (decoded === null) throw new Error('decode failed')
    assert.equal(decoded.header.typ, 'atproto-space-delegation+jwt')
    assert.equal(decoded.header.kid, '#atproto')
    assert.deepEqual(decoded.payload, {
      iss: 'did:example:user_did',
      sub: spaceUri,
      aud: 'did:example:space_did#atproto_space_host',
      iat: IAT,
      exp: IAT + 60,
      jti: 'f47ac10b58cc4372a5670e02b2c3d479',
    })
  })

  it('builds a single-use client attestation with iss == sub == client_id', () => {
    const attestation = createClientAttestation(appKey, {
      clientId: 'https://app.example.com/client-metadata.json',
      audience: 'did:example:space_did#atproto_space_host',
      now: IAT,
      jti: 'b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8',
    })
    const decoded = decodeJwt(attestation)
    if (decoded === null) throw new Error('decode failed')
    assert.equal(decoded.header.typ, 'atproto-client-attestation+jwt')
    assert.equal(decoded.header.kid, 'key-1')
    assert.equal(decoded.payload.iss, 'https://app.example.com/client-metadata.json')
    assert.equal(decoded.payload.sub, decoded.payload.iss)
    assert.equal(decoded.payload.aud, 'did:example:space_did#atproto_space_host')
    assert.equal(decoded.payload.exp, IAT + 60)
    assert.ok(jwtSignatureValid(attestation, pubFromJwk(appKey.jwk)))
  })
})

describe('space credential parsing', () => {
  it('accepts the proposal example shape bound to our DPoP key', () => {
    const parsed = parseSpaceCredential(mintSpecShapedCredential(), {
      spaceUri,
      jkt: appKey.jkt,
      now: IAT,
    })
    assert.deepEqual(parsed, {
      status: 'valid',
      claims: {
        iss: 'did:example:space_did',
        sub: spaceUri,
        cnf: { jkt: appKey.jkt },
        iat: IAT,
        exp: EXP,
        jti: '9f8e7d6c5b4a3210fedcba9876543210',
      },
    })
  })

  it('flags expired credentials', () => {
    const parsed = parseSpaceCredential(mintSpecShapedCredential(), {
      spaceUri,
      jkt: appKey.jkt,
      now: EXP + 1,
    })
    assert.equal(parsed.status, 'expired')
  })

  it('flags credentials minted for a different space', () => {
    const parsed = parseSpaceCredential(
      mintSpecShapedCredential({ sub: 'at://did:example:other/space/com.example.t/other' }),
      { spaceUri, jkt: appKey.jkt, now: IAT }
    )
    assert.equal(parsed.status, 'wrong-space')
  })

  it('flags credentials bound to another key', () => {
    const parsed = parseSpaceCredential(mintSpecShapedCredential({ cnf: { jkt: specJkt } }), {
      spaceUri,
      jkt: appKey.jkt,
      now: IAT,
    })
    assert.equal(parsed.status, 'wrong-key')
  })

  it('flags malformed credentials', () => {
    assert.equal(parseSpaceCredential('garbage', { now: IAT }).status, 'malformed')
    assert.equal(parseSpaceCredential('a.b', { now: IAT }).status, 'malformed')
    const wrongTyp = signEs256Jwt(
      new Uint8Array(32).fill(0x3b),
      { typ: 'atproto-space-delegation+jwt', alg: 'ES256' },
      { iss: 'did:example:space_did', sub: spaceUri, cnf: { jkt: appKey.jkt }, iat: IAT, exp: EXP, jti: 'x' }
    )
    assert.equal(parseSpaceCredential(wrongTyp, { now: IAT }).status, 'malformed')
  })
})

describe('credential exchange and presentation', () => {
  it('runs the delegation → credential flow end to end', async () => {
    const credentialEndpoint =
      'https://space.example.com/xrpc/com.atproto.space.getSpaceCredential'
    const bundle = await obtainSpaceCredential({
      space,
      now: IAT,
      createKey: () => appKey,
      random: (length) => new Uint8Array(length).fill(0x5c),
      credentialEndpoint,
      delegationToken: 'delegation-jwt',
      exchangeCredential: async (proof, exchangeInput) => {
        const decoded = decodeJwt(proof)
        if (decoded === null) throw new Error('decode failed')
        assert.equal(decoded.header.typ, 'dpop+jwt')
        assert.equal(decoded.payload.htm, 'POST')
        assert.equal(decoded.payload.htu, credentialEndpoint)
        assert.ok(jwtSignatureValid(proof, pubFromJwk(appKey.jwk)))
        assert.equal(exchangeInput.delegationToken, 'delegation-jwt')
        return mintSpecShapedCredential()
      },
    })
    assert.equal(bundle.claims.sub, spaceUri)
    assert.equal(bundle.claims.cnf.jkt, appKey.jkt)

    const headers = credentialAuthHeaders(bundle, {
      htm: 'GET',
      htu: 'https://pds.example.com/xrpc/com.atproto.space.getRepo',
      now: IAT + 10,
      jti: 'read-1',
    })
    assert.equal(headers.Authorization, `DPoP ${bundle.credential}`)
    const decoded = decodeJwt(headers.DPoP)
    if (decoded === null) throw new Error('decode failed')
    assert.equal(decoded.payload.ath, b64url(sha256(new TextEncoder().encode(bundle.credential))))
  })

  it('rejects a credential bound to a key that is not ours', async () => {
    await assert.rejects(
      obtainSpaceCredential({
        space,
        now: IAT,
        createKey: () => appKey,
        random: (length) => new Uint8Array(length).fill(0x5c),
        credentialEndpoint:
          'https://space.example.com/xrpc/com.atproto.space.getSpaceCredential',
        delegationToken: 'delegation-jwt',
        exchangeCredential: async () => mintSpecShapedCredential({ cnf: { jkt: specJkt } }),
      }),
      /wrong-key/
    )
  })

  it('refreshes only inside the expiry skew window', async () => {
    const bundle = await obtainSpaceCredential({
      space,
      now: IAT,
      createKey: () => appKey,
      random: (length) => new Uint8Array(length).fill(0x5c),
      credentialEndpoint:
        'https://space.example.com/xrpc/com.atproto.space.getSpaceCredential',
      delegationToken: 'delegation-jwt',
      exchangeCredential: async () => mintSpecShapedCredential(),
    })
    assert.equal(credentialNeedsRefresh(bundle, IAT), false)
    assert.equal(credentialNeedsRefresh(bundle, EXP - 301), false)
    assert.equal(credentialNeedsRefresh(bundle, EXP - 300), true)
  })
})

describe('jti generation', () => {
  it('yields 32-char hex strings that vary with the source', () => {
    assert.equal(newJti((length) => new Uint8Array(length).fill(0x7e)), '7e'.repeat(16))
    let counter = 0
    const counting = (length: number) => new Uint8Array(length).fill(counter++)
    assert.notEqual(newJti(counting), newJti(counting))
  })
})
