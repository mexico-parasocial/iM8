import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver'

const handleResolver = new CompositeHandleResolver({
  strategy: 'race',
  methods: {
    dns: new DohJsonHandleResolver({
      dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query',
    }),
    http: new WellKnownHandleResolver(),
  },
})

const docResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new WebDidDocumentResolver(),
  },
})

/**
 * Fetches a minidoc from slingshot
 *
 * @param identifier {string}
 * @returns {Promise<{did: string, handle: string, pds: string}>}
 */
async function getMiniDoc(identifier) {
  const result = await fetch(
    `https://slingshot.microcosm.blue/xrpc/blue.microcosm.identity.resolveMiniDoc?identifier=${identifier}`,
  )
  if (!result.ok) {
    throw new Error(`Failed to fetch minidoc: ${result.status} ${result.statusText}`)
  }
  return await result.json()
}

/**
 * Cleans the handle of @ and some other unicode characters that used to show up when copied from the profile
 * @param handle {string}
 * @returns {string}
 */
const cleanHandle = handle =>
  handle
    .replace('@', '')
    .trim()
    .replace(/[\u202A\u202C\u200E\u200F\u2066-\u2069]/g, '')

/**
 *  Convince helper to resolve a handle to a did and then find the PDS url from the did document.
 *
 * @param handle
 * @returns {Promise<{usersDid: string, pds: string}>}
 */
async function handleAndPDSResolver(handle) {
  try {
    const { did, handle: _, pds } = await getMiniDoc(handle)
    return { usersDid: did, pds }
  } catch (error) {
    console.error('Failed to load mini doc, trying other routes', error)
  }

  let usersDid = null
  if (handle.startsWith('did:')) {
    usersDid = handle
  } else {
    const cleanedHandle = cleanHandle(handle)
    usersDid = await handleResolver.resolve(cleanedHandle)
  }
  const didDoc = await docResolver.resolve(usersDid)

  let pds
  try {
    pds = didDoc.service?.filter(s => s.type === 'AtprotoPersonalDataServer')[0].serviceEndpoint
  } catch (error) {
    throw new Error('Could not find a PDS in the DID document.')
  }
  return { usersDid, pds }
}

/**
 *  Fetches the DID Web from the .well-known/did.json endpoint of the server.
 *  Legacy and was helpful if the web ui and server are on the same domain, not as useful now
 * @param baseUrl
 * @returns {Promise<*>}
 */
async function fetchPDSMooverDIDWeb(baseUrl) {
  const response = await fetch(`${baseUrl}/.well-known/did.json`)
  if (!response.ok) {
    throw new Error(`Failed to fetch DID document: ${response.status}`)
  }
  const didDoc = await response.json()
  return didDoc.id
}

export { handleResolver, docResolver, cleanHandle, handleAndPDSResolver, fetchPDSMooverDIDWeb }
