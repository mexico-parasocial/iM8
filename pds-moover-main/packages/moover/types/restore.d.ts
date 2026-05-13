export type Operation = import("@atcute/did-plc").Operation;
export class Restore {
    /**
     *
     * @param pdsMooverInstance {string} - The url of the pds moover instance to restore from. Defaults to https://pdsmover.com
     */
    constructor(pdsMooverInstance?: string);
    /**
     * If you want to use a different plc directory create your own instance of the plc ops class and pass it in here
     * @type {PlcOps} */
    plcOps: PlcOps;
    /**
     * This is the base url for the pds moover instance used to restore the files from a backup.
     * @type {string}
     */
    pdsMooverInstance: string;
    /**
     * To keep it simple, only uses secp256k for the temp verification key that is used to create the new account on the new PDS
     * and is temporarily assigned to the user's account on PLC
     * @type {null|Secp256k1PrivateKeyExportable}
     */
    tempVerificationKeypair: null | Secp256k1PrivateKeyExportable;
    /** @type {AtpAgent} */
    atpAgent: AtpAgent;
    /**
     * The keypair that is used to sign the plc operation
     * @type {null|{type: string, didPublicKey: `did:key:${string}`, keypair: P256PrivateKey|Secp256k1PrivateKey}}
     */
    recoveryRotationKeyPair: null | {
        type: string;
        didPublicKey: `did:key:${string}`;
        keypair: P256PrivateKey | Secp256k1PrivateKey;
    };
    /**
     * If this is true we are just restoring the repo and blobs. Ideally for rerunning a restore process after account recovery
     * @type {boolean}
     */
    RestoreFromBackup: boolean;
    /**
     * If set to true then it will do the account recovery. Writes a temp key to the did doc,
     * create a new account on the new pds, and then submit a new plc op for the pds to have control (finishes the migration, can always restore the backup later)
     * @type {boolean}
     */
    AccountRecovery: boolean;
    /**
     *  Recovers an account with the users rotation key and restores the repo from a PDS MOOver backup
     *  This method can fail, and the account was still recovered, it's best to check the PLC logs to see where an account stands before reruns
     * @param rotationKey {string} - The users private rotation key, can be a multi key or hex key
     * @param rotationKeyType {string} - The type of the key, secp256k1 or p256. Required if the key is in hex format, defaults to secp256k1
     * @param currentHandleOrDid {string} - The users current handle or did, if they don't have a DNS record it will have to be their did for success
     * @param newPDS {string} - The new PDS url, like https://coolnewpds.com
     * @param newHandle {string} - Can be the users DNS handle if it is already setup with their did, if not it's bob.mypds.com
     * @param newPassword {string} - The new password for the new account
     * @param newEmail {string} - The new email for the new account
     * @param inviteCode {string|null} - The invite code for the new PDS if it requires one
     * @param cidToRestoreTo {string|null} - The cid of the plc op to restore to, used mostly to revert a fraudulent plc op. Want to give it the last valid operations cid
     * @param verificationCode {string|null} - The verification code from the captcha/gate flow, required if the new PDS has phoneVerificationRequired
     * @param onStatus {function|null} - A function that takes a string used to update the UI. Like (status) => console.log(status)
     * @returns {Promise<void>} If there is a failure during restoring the back up (after the status Success! Restoring your repo...) then your account is most likely
     * recovered and future runs need to have the RestoreFromBackup flag set to true and AccountRecovery set to false.
     */
    recover(rotationKey: string, rotationKeyType: string, currentHandleOrDid: string, newPDS: string, newHandle: string, newPassword: string, newEmail: string, inviteCode: string | null, cidToRestoreTo?: string | null, verificationCode?: string | null, onStatus?: Function | null): Promise<void>;
    /**
     * This method signs the plc operation over to the new PDS and activates the account
     * Assumes you have already created a new account during the recovery process and logged in
     * Uses the recommended did doc from the PDS as a base and adds the users rotation key to the rotation keys array
     *
     * @param usersDid
     * @param additionalRotationKeysToAdd
     * @param prevCid
     * @returns {Promise<void>}
     */
    signRestorePlcOperation(usersDid: any, additionalRotationKeysToAdd: any[], prevCid: any): Promise<void>;
}
import { PlcOps } from './plc-ops.js';
import { Secp256k1PrivateKeyExportable } from '@atcute/crypto';
import { AtpAgent } from '@atproto/api';
import { P256PrivateKey } from '@atcute/crypto';
import { Secp256k1PrivateKey } from '@atcute/crypto';
//# sourceMappingURL=restore.d.ts.map