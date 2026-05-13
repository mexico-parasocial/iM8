/**
 * @typedef {import('@atcute/did-plc').Operation} Operation
 */
import { P256PrivateKey, Secp256k1PrivateKey } from '@atcute/crypto'
import { handleAndPDSResolver } from './atprotoUtils.js'
import { PlcOps } from './plc-ops.js'
import { normalizeOp } from '@atcute/did-plc'
import { AtpAgent } from '@atproto/api'
import { Secp256k1PrivateKeyExportable } from '@atcute/crypto'
import * as CBOR from '@atcute/cbor'
import { toBase64Url } from '@atcute/multibase'

class Restore {
  /**
   *
   * @param pdsMooverInstance {string} - The url of the pds moover instance to restore from. Defaults to https://pdsmover.com
   */
  constructor(pdsMooverInstance = 'https://pdsmover.com') {
    /**
     * If you want to use a different plc directory create your own instance of the plc ops class and pass it in here
     * @type {PlcOps} */
    this.plcOps = new PlcOps()

    /**
     * This is the base url for the pds moover instance used to restore the files from a backup.
     * @type {string}
     */
    this.pdsMooverInstance = pdsMooverInstance

    /**
     * To keep it simple, only uses secp256k for the temp verification key that is used to create the new account on the new PDS
     * and is temporarily assigned to the user's account on PLC
     * @type {null|Secp256k1PrivateKeyExportable}
     */
    this.tempVerificationKeypair = null

    /** @type {AtpAgent} */
    this.atpAgent = null

    /**
     * The keypair that is used to sign the plc operation
     * @type {null|{type: string, didPublicKey: `did:key:${string}`, keypair: P256PrivateKey|Secp256k1PrivateKey}}
     */
    this.recoveryRotationKeyPair = null

    /**
     * If this is true we are just restoring the repo and blobs. Ideally for rerunning a restore process after account recovery
     * @type {boolean}
     */
    this.RestoreFromBackup = true

    /**
     * If set to true then it will do the account recovery. Writes a temp key to the did doc,
     * create a new account on the new pds, and then submit a new plc op for the pds to have control (finishes the migration, can always restore the backup later)
     * @type {boolean}
     */
    this.AccountRecovery = true
  }

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
  async recover(
    rotationKey,
    rotationKeyType = 'secp256k1',
    currentHandleOrDid,
    newPDS,
    newHandle,
    newPassword,
    newEmail,
    inviteCode,
    cidToRestoreTo = null,
    verificationCode = null,
    onStatus = null,
  ) {
    if (onStatus) onStatus('Resolving your handle...')

    let { usersDid } = await handleAndPDSResolver(currentHandleOrDid)

    if (onStatus)
      onStatus(
        'Checking that the new PDS is an actual PDS (if the url is wrong, this takes a while to error out)',
      )
    this.atpAgent = new AtpAgent({ service: newPDS })
    const newHostDesc = await this.atpAgent.com.atproto.server.describeServer()

    //Check to see if the user already has a repo on the new PDS, if they do no reason to try and restore via the plc operations
    try {
      await this.atpAgent.com.atproto.repo.describeRepo({ repo: usersDid.toString() })
      //If we got this far and there is a repo on the new PDS with the users did, we can just move on and restore the files.
      //We do not want to mess with the plc ops if we dont have to
      this.AccountRecovery = false
    } catch (error) {
      console.error(error)
      let parsedError = error.error
      if (parsedError === 'RepoDeactivated') {
        //Ideally should mean they already have a repo on the new PDS and we just need to restore the files
        this.AccountRecovery = false
      }
      //This is the error we want to see, anything else throw
      if (parsedError !== 'RepoNotFound') {
        throw error
      }
    }

    //We need to double check that the new handle has not been taken, if it has we need to throw an error
    //We care a bit more because we do not want any unnecessary plc ops to be created
    try {
      let resolveHandle = await this.atpAgent.com.atproto.identity.resolveHandle({
        handle: newHandle,
      })
      if (resolveHandle.data.did === usersDid.toString()) {
        //This was originally setting the AccountRecovery to false, which works if it is resolved via .well-known, but not dns
        //The idea was to check and see if the handle has been taken. just leaving for now since it does that check and if the user owns the handle
        //their did should be set anyhow
      } else {
        //There is a repo with that name and it's not the users did,
        throw new Error('The new handle is already taken, please select a different handle')
      }
    } catch (error) {
      // Going to silently log this and just assume the handle has not been taken.
      console.error(error)
      if (error.message.startsWith('The new handle')) {
        //it's not our custom error, so we can just throw it
        throw error
      }
    }

    if (this.AccountRecovery) {
      if (onStatus) onStatus('Validating your private rotation key is in the correct format...')

      this.recoveryRotationKeyPair = await this.plcOps.getKeyPair(rotationKey, rotationKeyType)

      if (onStatus) onStatus('Resolving PlC operation logs...')

      /** @type  {Operation} */
      let baseOpForSigning = null
      let opPrevCid = null

      //This is for reversals against a rogue plc op and you want to restore to a specific cid in the audit log
      if (cidToRestoreTo) {
        let auditLogs = await this.plcOps.getPlcAuditLogs(usersDid)
        for (const log of auditLogs) {
          if (log.cid === cidToRestoreTo) {
            baseOpForSigning = normalizeOp(log.operation)
            opPrevCid = log.cid
            break
          }
        }
        if (!baseOpForSigning) {
          throw new Error('Could not find the cid in the audit logs')
        }
      } else {
        let { lastOperation, base } = await this.plcOps.getLastPlcOpFromPlc(usersDid)
        opPrevCid = base.cid
        baseOpForSigning = lastOperation
      }

      if (onStatus) onStatus('Preparing to switch to a temp atproto key...')
      if (this.tempVerificationKeypair == null) {
        if (onStatus) onStatus('Creating a new temp atproto key...')
        this.tempVerificationKeypair = await Secp256k1PrivateKeyExportable.createKeypair()
      }
      //Just defaulting to the user's recovery key for now. Advance cases will be something else
      //Maybe just a new ui to edit the PLC doc in a limited capacity, but sinc ethis is a temp plc op i don't think it's needed
      let tempRotationKeys = [this.recoveryRotationKeyPair.didPublicKey]

      if (onStatus) onStatus('Modifying the PLC OP for recovery...')
      //A temp plc op for control of the atproto key to create a serviceAuth and new account on the new PDS
      await this.plcOps.signAndPublishNewOp(
        usersDid,
        this.recoveryRotationKeyPair.keypair,
        baseOpForSigning.alsoKnownAs,
        tempRotationKeys,
        newPDS,
        await this.tempVerificationKeypair.exportPublicKey('did'),
        opPrevCid,
      )

      if (onStatus) onStatus('Creating your new account on the new PDS...')
      let serviceAuthToken = await this.plcOps.createANewServiceAuthToken(
        usersDid,
        newHostDesc.data.did,
        this.tempVerificationKeypair,
        'com.atproto.server.createAccount',
      )

      let createAccountRequest = {
        did: usersDid,
        handle: newHandle,
        email: newEmail,
        password: newPassword,
      }
      if (inviteCode) {
        createAccountRequest.inviteCode = inviteCode
      }
      if (verificationCode) {
        createAccountRequest.verificationCode = verificationCode
      }
      const _ = await this.atpAgent.com.atproto.server.createAccount(createAccountRequest, {
        headers: { authorization: `Bearer ${serviceAuthToken}` },
        encoding: 'application/json',
      })
    }

    await this.atpAgent.login({
      identifier: usersDid,
      password: newPassword,
    })

    if (this.AccountRecovery) {
      //Moving the user offically to the new PDS
      if (onStatus) onStatus('Signing the papers...')
      let { base } = await this.plcOps.getLastPlcOpFromPlc(usersDid)
      await this.signRestorePlcOperation(
        usersDid,
        [this.recoveryRotationKeyPair.didPublicKey],
        base.cid,
      )
    }

    if (this.RestoreFromBackup) {
      if (onStatus) onStatus('Success! Restoring your repo...')
      const pdsMoover = new AtpAgent({ service: this.pdsMooverInstance })
      const repoRes = await pdsMoover.com.atproto.sync.getRepo({ did: usersDid })
      await this.atpAgent.com.atproto.repo.importRepo(repoRes.data, {
        encoding: 'application/vnd.ipld.car',
      })

      if (onStatus) onStatus('Restoring your blobs...')

      //Using the missing endpoint to findout what's missing then the PDS MOOver endpoint to restore
      let totalMissingBlobs = 0
      let missingBlobCursor = undefined
      let missingUploadedBlobs = 0

      do {
        const missingBlobs = await this.atpAgent.com.atproto.repo.listMissingBlobs({
          cursor: missingBlobCursor,
          limit: 1000,
        })
        totalMissingBlobs += missingBlobs.data.blobs.length

        for (const recordBlob of missingBlobs.data.blobs) {
          try {
            const blobRes = await pdsMoover.com.atproto.sync.getBlob({
              did: usersDid,
              cid: recordBlob.cid,
            })
            let result = await this.atpAgent.com.atproto.repo.uploadBlob(blobRes.data, {
              encoding: blobRes.headers['content-type'],
            })

            if (missingUploadedBlobs % 2 === 0) {
              if (onStatus)
                onStatus(
                  `Migrating blobs: ${missingUploadedBlobs}/${totalMissingBlobs} (The total may increase as we find more)`,
                )
            }
            missingUploadedBlobs++
          } catch (error) {
            console.error(error)
          }
        }
        missingBlobCursor = missingBlobs.data.cursor
      } while (missingBlobCursor)
    }
    const accountStatus = await this.atpAgent.com.atproto.server.checkAccountStatus()
    if (!accountStatus.data.activated) {
      if (onStatus) onStatus('Activating your account...')
      await this.atpAgent.com.atproto.server.activateAccount()
    }
  }

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
  async signRestorePlcOperation(usersDid, additionalRotationKeysToAdd = [], prevCid) {
    const getDidCredentials =
      await this.atpAgent.com.atproto.identity.getRecommendedDidCredentials()

    const pdsProvidedRotationKeys = getDidCredentials.data.rotationKeys ?? []
    //Puts the provided rotation keys above the pds pro
    const rotationKeys = [
      ...new Set([...(additionalRotationKeysToAdd || []), ...pdsProvidedRotationKeys]),
    ]
    if (!rotationKeys) {
      throw new Error('No rotation keys were found to be added to the PLC')
    }

    if (rotationKeys.length > 5) {
      throw new Error('You can only add up to 5 rotation keys to the PLC')
    }

    const plcOpToSubmit = {
      type: 'plc_operation',
      ...getDidCredentials.data,
      prev: prevCid,
      rotationKeys: rotationKeys,
    }

    const opBytes = CBOR.encode(plcOpToSubmit)
    const sigBytes = await this.recoveryRotationKeyPair.keypair.sign(opBytes)

    const signature = toBase64Url(sigBytes)

    const signedOperation = {
      ...plcOpToSubmit,
      sig: signature,
    }

    await this.plcOps.pushPlcOperation(usersDid, signedOperation)
    await this.atpAgent.com.atproto.server.activateAccount()
  }
}

export { Restore }
