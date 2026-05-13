/**
 * Handles normal PDS Migrations between two PDSs that are both up.
 * On pdsmoover.com this is the logic for the MOOver
 */
export class Migrator {
    /** @type {AtpAgent} */
    oldAgent: AtpAgent;
    /** @type {AtpAgent} */
    newAgent: AtpAgent;
    /** @type {[string]} */
    missingBlobs: [string];
    /** @type {boolean} */
    createNewAccount: boolean;
    /** @type {boolean} */
    migrateRepo: boolean;
    /** @type {boolean} */
    migrateBlobs: boolean;
    /** @type {boolean} */
    migrateMissingBlobs: boolean;
    /** @type {boolean} */
    migratePrefs: boolean;
    /** @type {boolean} */
    migratePlcRecord: boolean;
    /**
     * How many blobs have been uploaded to the new PDS in the current step
     @type {number} */
    uploadedBlobsCount: number;
    /**
     * Uploads blobs to the new PDS
     * @param {AtpAgent} oldAgent
     * @param {AtpAgent} newAgent
     * @param {string} usersDid
     * @param {[string]} cids
     * @param {number} totalBlobs
     * @param {function|null} statusUpdateHandler
     */
    uploadBlobs(oldAgent: AtpAgent, newAgent: AtpAgent, usersDid: string, cids: [string], totalBlobs: number, statusUpdateHandler: Function | null): Promise<void>;
    /**
     * This migrator is pretty cut and dry and makes a few assumptions
     * 1. You are using the same password between each account
     * 2. If this command fails for something like oauth 2fa code it throws an error and expects the same values when ran again.
     * 3. You can control which "actions" happen by setting the class variables to false.
     * 4. Each instance of the class is assumed to be for a single migration
     * @param {string} oldHandle - The handle you use on your old pds, something like alice.bsky.social
     * @param {string} password - Your password for your current login. Has to be your real password, no app password. When setting up a new account we reuse it as well for that account
     * @param {string} newPdsUrl - The new URL for your pds. Like https://coolnewpds.com
     * @param {string} newEmail - The email you want to use on the new pds (can be the same as the previous one as long as it's not already being used on the new pds)
     * @param {string} newHandle - The new handle you want, like alice.bsky.social, or if you already have a domain name set as a handle can use it myname.com.
     * @param {string|null} inviteCode - The invite code you got from the PDS you are migrating to. If null does not include one
     * @param {function|null} statusUpdateHandler - a function that takes a string used to update the UI. Like (status) => console.log(status)
     * @param {string|null} twoFactorCode - Optional, but needed if it fails with 2fa required
     * @param verificationCode - Optional verification captcha code for account creation if the PDS requires it
     * @param {string|null} sourcePdsUrl - Optional URL to use as the source PDS instead of resolving from DID doc
     */
    migrate(oldHandle: string, password: string, newPdsUrl: string, newEmail: string, newHandle: string, inviteCode: string | null, statusUpdateHandler?: Function | null, twoFactorCode?: string | null, verificationCode?: any, sourcePdsUrl?: string | null): Promise<void>;
    /**
     *  Sign and submits the PLC operation to officially migrate the account
     * @param {string} token - the PLC token sent in the email. If you're just wanting to run this rerun migrate with all the flags set as false except for migratePlcRecord
     * @param additionalRotationKeysToAdd {string[]} - additional rotation keys to add in addition to the ones provided by the new PDS.
     * @returns {Promise<void>}
     */
    signPlcOperation(token: string, additionalRotationKeysToAdd?: string[]): Promise<void>;
    /**
     * Using this method assumes the Migrator class was constructed new and this was called.
     * Find the user's previous PDS from the PLC op logs,
     * logs in and deactivates their old account if it was found still active.
     *
     * @param oldHandle {string}
     * @param oldPassword {string}
     * @param {function|null} statusUpdateHandler - a function that takes a string used to update the UI.
     * Like (status) => console.log(status)
     * @param {string|null} twoFactorCode - Optional, but needed if it fails with 2fa required
     * @returns {Promise<void>}
     */
    deactivateOldAccount(oldHandle: string, oldPassword: string, statusUpdateHandler?: Function | null, twoFactorCode?: string | null): Promise<void>;
    /**
     * Signs the logged-in user in this.newAgent for backups with PDS MOOver. This is usually called after migrate and signPlcOperation are successful
     *
     * @param {string} didWeb
     * @returns {Promise<void>}
     */
    signUpForBackupsFromMigration(didWeb?: string): Promise<void>;
}
import { AtpAgent } from '@atproto/api';
//# sourceMappingURL=pdsmoover.d.ts.map