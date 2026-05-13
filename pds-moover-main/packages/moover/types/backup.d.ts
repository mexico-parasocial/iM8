/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 */
export type InferXRPCBodyOutput = any;
/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 * @typedef {import('@atcute/lexicons').InferXRPCBodyOutput} InferXRPCBodyOutput
 */
/**
 * Logic to sign up and manage backups for pdsmoover.com (or your own selfhosted instance)
 */
export class BackupService {
    /**
     *
     * @param backupDidWeb {string} - The did:web for the xrpc service for backups, defaults to did:web:pdsmoover.com
     */
    constructor(backupDidWeb?: string);
    /**
     *
     * @type {Client}
     */
    atCuteClient: Client;
    /**
     *
     * @type {CredentialManager}
     */
    atCuteCredentialManager: CredentialManager;
    /**
     * The did:web for the xrpc service for backups, defaults to pdsmoover.com
     * @type {string}
     */
    backupDidWeb: string;
    /**
     *  Logs in and returns the backup status.
     *  To use the rest of the BackupService, it is assumed that this has ran first,
     *  and the user has successfully signed up. A successful login is a returned null if the user has not signed up.
     *  or the backup status if they are
     *
     *  If the server requires 2FA,
     *  it will throw with error.error === 'AuthFactorTokenRequired'.
     * @param identifier {string} handle or did
     * @param password {string}
     * @param {function|null} onStatus - a function that takes a string used to update the UI.
     * Like (status) => console.log(status)
     * @param twoFactorCode {string|null}
     *
     * @returns {Promise<InferXRPCBodyOutput<ComPdsmooverBackupDescribeServer.mainSchema['output']>|null>}
     */
    loginAndStatus(identifier: string, password: string, onStatus?: Function | null, twoFactorCode?: string | null): Promise<InferXRPCBodyOutput<ComPdsmooverBackupDescribeServer.mainSchema["output"]> | null>;
    /**
     * Signs the user up for backups with the service
     * @param onStatus
     * @returns {Promise<void>}
     */
    signUp(onStatus?: any): Promise<void>;
    /**
     * Requests a PLC token to be sent to the user's email, needed to add a new rotation key
     * @returns {Promise<void>}
     */
    requestAPlcToken(): Promise<void>;
    /**
     *  Adds a new rotation to the users did document. Assumes you are already signed in.
     *
     *  WARNING: This will overwrite any existing rotation keys with the new one at the top, and the PDS key as the second one
     * @param plcToken {string} - PLC token from the user's email that was sent from requestAPlcToken
     * @param rotationKey {string} - The new rotation key to add to the user's did document
     * @returns {Promise<void>}
     */
    addANewRotationKey(plcToken: string, rotationKey: string): Promise<void>;
    /**
     *
     *  Gets the current status of the user's backup repository.
     *
     * @param onStatus {function|null} - a function that takes a string used to update the UI.
     * @returns {Promise<InferXRPCBodyOutput<ComPdsmooverBackupDescribeServer.mainSchema['output']>>}
     */
    getUsersRepoStatus(onStatus?: Function | null): Promise<InferXRPCBodyOutput<ComPdsmooverBackupDescribeServer.mainSchema["output"]>>;
    /**
     * Requests a backup to be run immediately for the signed-in user. Usually does, depend on the server's backup queue
     * @param onStatus
     * @returns {Promise<boolean>}
     */
    runBackupNow(onStatus?: any): Promise<boolean>;
    /**
     * Remove (delete) the signed-in user's backup repository. this also deletes all the user's backup data.
     * @param onStatus
     * @returns {Promise<boolean>}
     */
    removeRepo(onStatus?: any): Promise<boolean>;
}
import { Client } from '@atcute/client';
import { CredentialManager } from '@atcute/client';
import { ComPdsmooverBackupDescribeServer } from '@pds-moover/lexicons';
//# sourceMappingURL=backup.d.ts.map