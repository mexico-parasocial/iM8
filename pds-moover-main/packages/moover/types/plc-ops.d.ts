/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 */
export type defs = typeof defs;
/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 */
export type normalizeOp = any;
/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 */
export type Operation = import("@atcute/did-plc").Operation;
/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 */
export type CompatibleOperation = import("@atcute/did-plc").CompatibleOperation;
/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 */
export type IndexedEntryLog = import("@atcute/did-plc").IndexedEntryLog;
/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 */
export type IndexedEntry = import("@atcute/did-plc").IndexedEntry;
/**
 * Class to help with various PLC operations
 */
export class PlcOps {
    /**
     *
     * @param plcDirectoryUrl {string} - The url of the plc directory, defaults to https://plc.directory
     */
    constructor(plcDirectoryUrl?: string);
    /**
     * The url of the plc directory
     * @type {string}
     */
    plcDirectoryUrl: string;
    /**
     *  Gets the current rotation keys for a user via their last PlC operation
     * @param did
     * @returns {Promise<string[]>}
     */
    getCurrentRotationKeysForUser(did: any): Promise<string[]>;
    /**
     *  Gets the last PlC operation for a user from the plc directory
     * @param did
     * @returns {Promise<{lastOperation: Operation, base: any}>}
     */
    getLastPlcOpFromPlc(did: any): Promise<{
        lastOperation: Operation;
        base: any;
    }>;
    /**
     *
     * @param logs {IndexedEntryLog}
     * @returns {{lastOperation: Operation, base: IndexedEntry}}
     */
    getLastPlcOp(logs: IndexedEntryLog): {
        lastOperation: Operation;
        base: IndexedEntry;
    };
    /**
     *  Gets the plc audit logs for a user from the plc directory
     * @param did
     * @returns {Promise<IndexedEntryLog>}
     */
    getPlcAuditLogs(did: any): Promise<IndexedEntryLog>;
    /**
     * Creates a new secp256k1 key that can be used for either rotation or verification key
     * @returns {Promise<{privateKey: string, publicKey: `did:key:${string}`}>}
     */
    createANewSecp256k1(): Promise<{
        privateKey: string;
        publicKey: `did:key:${string}`;
    }>;
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
    signAndPublishNewOp(did: string, signingRotationKey: P256PrivateKey | Secp256k1PrivateKey, alsoKnownAs: string[], rotationKeys: string[], pds: string, verificationKey: string, prev: string): Promise<void>;
    /**
     * Takes a multi or hex based private key and returns a keypair
     * @param privateKeyString {string}
     * @param type {string} - secp256k1 or p256, needed if the private key is hex based, can be assumed if it's a multikey
     * @returns {Promise<{type: string, didPublicKey: `did:key:${string}`, keypair: P256PrivateKey|Secp256k1PrivateKey}>}
     */
    getKeyPair(privateKeyString: string, type?: string): Promise<{
        type: string;
        didPublicKey: `did:key:${string}`;
        keypair: P256PrivateKey | Secp256k1PrivateKey;
    }>;
    /**
     * Submits a new operation to the plc directory
     * @param did {string} - The user's did
     * @param operation
     * @returns {Promise<void>}
     */
    pushPlcOperation(did: string, operation: any): Promise<void>;
    /**
     * Creates a new service auth token for a user. This is what is used to create a new account on a PDS for your did
     *
     * @param iss The user's did
     * @param aud The did:web, if it's a PDS it's usually from /xrpc/com.atproto.server.describeServer
     * @param keypair The keypair to sign with only supporting ES256K atm
     * @param lxm The lxm which is usually com.atproto.server.createAccount for creating a new account
     * @returns {Promise<string>}
     */
    createANewServiceAuthToken(iss: any, aud: any, keypair: any, lxm: any): Promise<string>;
}
import { defs } from '@atcute/did-plc';
import { P256PrivateKey } from '@atcute/crypto';
import { Secp256k1PrivateKey } from '@atcute/crypto';
//# sourceMappingURL=plc-ops.d.ts.map