export const handleResolver: CompositeHandleResolver;
export const docResolver: CompositeDidDocumentResolver<"plc" | "web">;
/**
 * Cleans the handle of @ and some other unicode characters that used to show up when copied from the profile
 * @param handle {string}
 * @returns {string}
 */
export function cleanHandle(handle: string): string;
/**
 *  Convince helper to resolve a handle to a did and then find the PDS url from the did document.
 *
 * @param handle
 * @returns {Promise<{usersDid: string, pds: string}>}
 */
export function handleAndPDSResolver(handle: any): Promise<{
    usersDid: string;
    pds: string;
}>;
/**
 *  Fetches the DID Web from the .well-known/did.json endpoint of the server.
 *  Legacy and was helpful if the web ui and server are on the same domain, not as useful now
 * @param baseUrl
 * @returns {Promise<*>}
 */
export function fetchPDSMooverDIDWeb(baseUrl: any): Promise<any>;
import { CompositeHandleResolver } from '@atcute/identity-resolver';
import { CompositeDidDocumentResolver } from '@atcute/identity-resolver';
//# sourceMappingURL=atprotoUtils.d.ts.map