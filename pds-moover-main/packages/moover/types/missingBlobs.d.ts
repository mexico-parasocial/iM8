/**
 * Class to help find missing blobs from the did's previous PDS and import them into the current PDS
 */
export class MissingBlobs {
    /**
     * The user's current PDS agent
     * @type {AtpAgent}
     */
    currentPdsAgent: AtpAgent;
    /**
     * The user's old PDS agent
     * @type {AtpAgent}
     */
    oldPdsAgent: AtpAgent;
    /**
     * the user's did
     * @type {string|null}
     */
    did: string | null;
    /**
     * The user's current PDS url
     * @type {null}
     */
    currentPdsUrl: any;
    /**
     * A list of the missing cids blobs from the old PDS. In this case if a retry upload fails it gets put in this array for the ui
     * @type {string[]}
     */
    missingBlobs: string[];
    /**
     * Logs the user into the current PDS and gets the account status
     * @param handle {string}
     * @param password {string}
     * @param twoFactorCode {string|null}
     * @returns {Promise<{accountStatus: OutputSchema, missingBlobsCount: number}>}
     */
    currentAgentLogin(handle: string, password: string, twoFactorCode?: string | null): Promise<{
        accountStatus: OutputSchema;
        missingBlobsCount: number;
    }>;
    /**
     * Logs into the old PDS and gets the account status.
     * Does not need a handle
     * since it is assumed the user has already logged in with the current PDS and we are using their did
     * @param password {string}
     * @param twoFactorCode {string|null}
     * @param pdsUrl {string|null} - If you know the url of the old PDS you can pass it in here. If not it will be guessed at from plc ops
     * @returns {Promise<void>}
     */
    oldAgentLogin(password: string, twoFactorCode?: string | null, pdsUrl?: string | null): Promise<void>;
    /**
     * Gets the missing blobs from the old PDS and uploads them to the current PDS
     * @param statusUpdateHandler {function} - A function to update the status of the migration. This is useful for showing the user the progress of the migration
     * @returns {Promise<{accountStatus: OutputSchema, missingBlobsCount: number}>}
     */
    migrateMissingBlobs(statusUpdateHandler: Function): Promise<{
        accountStatus: OutputSchema;
        missingBlobsCount: number;
    }>;
}
import { AtpAgent } from '@atproto/api';
//# sourceMappingURL=missingBlobs.d.ts.map