import {docResolver, cleanHandle, handleResolver, handleAndPDSResolver} from './atprotoUtils.js'
import {AtpAgent} from '@atproto/api'

function safeStatusUpdate(statusUpdateHandler, status) {
    if (statusUpdateHandler) {
        statusUpdateHandler(status)
    }
}

/**
 * Handles normal PDS Migrations between two PDSs that are both up.
 * On pdsmoover.com this is the logic for the MOOver
 */
class Migrator {
    constructor() {
        /** @type {AtpAgent} */
        this.oldAgent = null
        /** @type {AtpAgent} */
        this.newAgent = null
        /** @type {[string]} */
        this.missingBlobs = []
        //State for reruns
        /** @type {boolean} */
        this.createNewAccount = true
        /** @type {boolean} */
        this.migrateRepo = true
        /** @type {boolean} */
        this.migrateBlobs = true
        /** @type {boolean} */
        this.migrateMissingBlobs = true
        /** @type {boolean} */
        this.migratePrefs = true
        /** @type {boolean} */
        this.migratePlcRecord = true
        /**
         * How many blobs have been uploaded to the new PDS in the current step
         @type {number} */
        this.uploadedBlobsCount = 0
    }

    /**
     * Uploads blobs to the new PDS
     * @param {AtpAgent} oldAgent
     * @param {AtpAgent} newAgent
     * @param {string} usersDid
     * @param {[string]} cids
     * @param {number} totalBlobs
     * @param {function|null} statusUpdateHandler
     */
    async uploadBlobs(oldAgent, newAgent, usersDid, cids, totalBlobs, statusUpdateHandler) {
        for (const cid of cids) {
            try {
                const blobRes = await oldAgent.com.atproto.sync.getBlob({
                    did: usersDid,
                    cid,
                })
                await newAgent.com.atproto.repo.uploadBlob(blobRes.data, {
                    encoding: blobRes.headers['content-type'],
                })
                this.uploadedBlobsCount++
                if (this.uploadedBlobsCount % 10 === 0) {
                    safeStatusUpdate(
                        statusUpdateHandler,
                        `Migrating blobs: ${this.uploadedBlobsCount}/${totalBlobs}`,
                    )
                }
            } catch (error) {
                console.error(error)
            }
        }
    }

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
     * @param {string|null} sourcePdsUrl - Optional URL to use as the source PDS instead of resolving from DID doc. Useful for moving from one PDS to another without changing the PDS hostname in the diddoc
     */
    async migrate(
        oldHandle,
        password,
        newPdsUrl,
        newEmail,
        newHandle,
        inviteCode,
        statusUpdateHandler = null,
        twoFactorCode = null,
        verificationCode = null,
        sourcePdsUrl = null,
    ) {
        oldHandle = cleanHandle(oldHandle)
        let oldAgent
        let usersDid
        if (sourcePdsUrl) {
            // Use the provided source PDS URL instead of resolving from DID doc
            safeStatusUpdate(statusUpdateHandler, `Using provided source PDS: ${sourcePdsUrl}`)
            console.log(`Using provided source PDS: ${sourcePdsUrl}`)
            usersDid = await handleResolver.resolve(oldHandle)
            oldAgent = new AtpAgent({service: sourcePdsUrl})
        } else if (oldHandle.endsWith('.bsky.social')) {
            //If it's a bsky handle just go with the entryway and let it sort everything
            oldAgent = new AtpAgent({service: 'https://bsky.social'})
            const publicAgent = new AtpAgent({
                service: 'https://public.api.bsky.app',
            })
            const resolveIdentityFromEntryway = await publicAgent.com.atproto.identity.resolveHandle({
                handle: oldHandle,
            })
            usersDid = resolveIdentityFromEntryway.data.did
        } else {
            //Resolves the did and finds the did document for the old PDS
            safeStatusUpdate(statusUpdateHandler, 'Resolving old PDS')
            let {usersDid: didFromLookUp, pds: oldPds} = await handleAndPDSResolver(oldHandle)
            usersDid = didFromLookUp

            oldAgent = new AtpAgent({
                service: oldPds,
            })
        }

        safeStatusUpdate(statusUpdateHandler, 'Logging you in to the old PDS')
        //Login to the old PDS
        if (twoFactorCode === null) {
            await oldAgent.login({identifier: oldHandle, password})
        } else {
            await oldAgent.login({
                identifier: oldHandle,
                password: password,
                authFactorToken: twoFactorCode,
            })
        }

        safeStatusUpdate(
            statusUpdateHandler,
            'Checking that the new PDS is an actual PDS (if the url is wrong this takes a while to error out)',
        )
        console.log('New PDS URL:', newPdsUrl)
        const newAgent = new AtpAgent({service: newPdsUrl})
        const newHostDesc = await newAgent.com.atproto.server.describeServer()

        if (this.createNewAccount) {
            let needToCreateANewAccount = true
            //check to see if repo already exists
            try {
                // If successful at all means the repo is there
                const _ = await newAgent.com.atproto.sync.getRepoStatus({
                    did: usersDid,
                })
                needToCreateANewAccount = false
                // Sets the migrate blobs flag to false so it moves on to just migrate missing blobs in the event of a retry
                this.migrateBlobs = false
                console.log('New check. Repo already exists, logging in')
            } catch (error) {
                //Should be good to cont, just logging in case we need it in the future for troubleshooting
                console.error('Expected Error on RepoStatus check.', error)
            }

            if (needToCreateANewAccount) {
                const newHostWebDid = newHostDesc.data.did

                safeStatusUpdate(statusUpdateHandler, 'Creating a new account on the new PDS')

                const createAuthResp = await oldAgent.com.atproto.server.getServiceAuth({
                    aud: newHostWebDid,
                    lxm: 'com.atproto.server.createAccount',
                })
                const serviceJwt = createAuthResp.data.token

                let createAccountRequest = {
                    did: usersDid,
                    handle: newHandle,
                    email: newEmail,
                    password: password,
                }
                if (inviteCode) {
                    createAccountRequest.inviteCode = inviteCode
                }
                if (verificationCode) {
                    createAccountRequest.verificationCode = verificationCode
                }
                try {
                    const createNewAccount = await newAgent.com.atproto.server.createAccount(
                        createAccountRequest,
                        {
                            headers: {authorization: `Bearer ${serviceJwt}`},
                            encoding: 'application/json',
                        },
                    )

                    if (createNewAccount.data.did !== usersDid.toString()) {
                        throw new Error('Did not create the new account with the same did as the old account')
                    }
                } catch (error) {
                    // Ideally should catch if the repo already exists, and if so silently log it and move along to the next step
                    if (error?.error === 'AlreadyExists') {
                        // Sets the migrate blobs flag to false so it moves on to just migrate missing blobs in the event of a retry
                        this.migrateBlobs = false
                        console.log('Repo already exists, logging in')
                    } else {
                        // Catches any other error and stops the migration process
                        throw error
                    }
                }
            }
        }

        safeStatusUpdate(statusUpdateHandler, 'Logging in with the new account')

        await newAgent.login({
            identifier: usersDid,
            password: password,
        })

        if (this.migrateRepo) {
            safeStatusUpdate(statusUpdateHandler, 'Migrating your repo')
            const repoRes = await oldAgent.com.atproto.sync.getRepo({
                did: usersDid,
            })
            await newAgent.com.atproto.repo.importRepo(repoRes.data, {
                encoding: 'application/vnd.ipld.car',
            })
        }

        let newAccountStatus = await newAgent.com.atproto.server.checkAccountStatus()

        if (this.migrateBlobs) {
            safeStatusUpdate(statusUpdateHandler, 'Migrating your blobs')

            let blobCursor = undefined
            let uploadedBlobs = 0
            do {
                safeStatusUpdate(
                    statusUpdateHandler,
                    `Migrating blobs: ${uploadedBlobs}/${newAccountStatus.data.expectedBlobs}`,
                )

                const listedBlobs = await oldAgent.com.atproto.sync.listBlobs({
                    did: usersDid,
                    cursor: blobCursor,
                    limit: 100,
                })

                await this.uploadBlobs(
                    oldAgent,
                    newAgent,
                    usersDid,
                    listedBlobs.data.cids,
                    newAccountStatus.data.expectedBlobs,
                    statusUpdateHandler,
                )
                blobCursor = listedBlobs.data.cursor
            } while (blobCursor)
            // Resets since this is a shared state with missing blobs job
            this.uploadedBlobsCount = 0
        }

        if (this.migrateMissingBlobs) {
            newAccountStatus = await newAgent.com.atproto.server.checkAccountStatus()
            if (newAccountStatus.data.expectedBlobs !== newAccountStatus.data.importedBlobs) {
                let totalMissingBlobs =
                    newAccountStatus.data.expectedBlobs - newAccountStatus.data.importedBlobs
                safeStatusUpdate(
                    statusUpdateHandler,
                    'Looks like there are some missing blobs. Going to try and upload them now.',
                )
                //Probably should be shared between main blob uploader, but eh
                let missingBlobCursor = undefined
                let missingUploadedBlobs = 0
                do {
                    safeStatusUpdate(
                        statusUpdateHandler,
                        `Migrating blobs: ${missingUploadedBlobs}/${totalMissingBlobs}`,
                    )

                    const missingBlobs = await newAgent.com.atproto.repo.listMissingBlobs({
                        cursor: missingBlobCursor,
                        limit: 100,
                    })

                    let missingCids = missingBlobs.data.blobs.map(blob => blob.cid)
                    await this.uploadBlobs(
                        oldAgent,
                        newAgent,
                        usersDid,
                        missingCids,
                        totalMissingBlobs,
                        statusUpdateHandler,
                    )

                    missingBlobCursor = missingBlobs.data.cursor
                } while (missingBlobCursor)
                // Resets since this is a shared state with the migrate blobs job
                this.uploadedBlobsCount = 0
            }
        }
        if (this.migratePrefs) {
            const prefs = await oldAgent.app.bsky.actor.getPreferences()
            await newAgent.app.bsky.actor.putPreferences(prefs.data)
        }

        this.oldAgent = oldAgent
        this.newAgent = newAgent

        if (this.migratePlcRecord) {
            await oldAgent.com.atproto.identity.requestPlcOperationSignature()
            safeStatusUpdate(
                statusUpdateHandler,
                'Please check your email attached to your previous account for a PLC token',
            )
        }
    }

    /**
     *  Sign and submits the PLC operation to officially migrate the account
     * @param {string} token - the PLC token sent in the email. If you're just wanting to run this rerun migrate with all the flags set as false except for migratePlcRecord
     * @param additionalRotationKeysToAdd {string[]} - additional rotation keys to add in addition to the ones provided by the new PDS.
     * @returns {Promise<void>}
     */
    async signPlcOperation(token, additionalRotationKeysToAdd = []) {
        const getDidCredentials =
            await this.newAgent.com.atproto.identity.getRecommendedDidCredentials()
        const pdsProvidedRotationKeys = getDidCredentials.data.rotationKeys ?? []
        // Prepend any additional rotation keys (e.g., user-added keys, newly created key) so they appear above the new PDS rotation key
        const rotationKeys = [...(additionalRotationKeysToAdd || []), ...pdsProvidedRotationKeys]
        if (!rotationKeys) {
            throw new Error('No rotation key provided from the new PDS')
        }
        const credentials = {
            ...getDidCredentials.data,
            rotationKeys: rotationKeys,
        }

        const plcOp = await this.oldAgent.com.atproto.identity.signPlcOperation({
            token: token,
            ...credentials,
        })

        await this.newAgent.com.atproto.identity.submitPlcOperation({
            operation: plcOp.data.operation,
        })

        await this.newAgent.com.atproto.server.activateAccount()
        await this.oldAgent.com.atproto.server.deactivateAccount({})
    }

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
    async deactivateOldAccount(
        oldHandle,
        oldPassword,
        statusUpdateHandler = null,
        twoFactorCode = null,
    ) {
        //Leaving this logic that either sets the agent to bsky.social, or the PDS since it's what I found worked best for migrations.
        // handleAndPDSResolver should be able to handle it, but there have been edge cases and this was what worked best        oldHandle = cleanHandle(oldHandle);
        let usersDid
        //If it's a bsky handle just go with the entryway and let it sort everything
        if (oldHandle.endsWith('.bsky.social')) {
            const publicAgent = new AtpAgent({
                service: 'https://public.api.bsky.app',
            })
            const resolveIdentityFromEntryway = await publicAgent.com.atproto.identity.resolveHandle({
                handle: oldHandle,
            })
            usersDid = resolveIdentityFromEntryway.data.did
        } else {
            //Resolves the did and finds the did document for the old PDS
            safeStatusUpdate(statusUpdateHandler, 'Resolving did from handle')
            usersDid = await handleResolver.resolve(oldHandle)
        }

        const didDoc = await docResolver.resolve(usersDid)
        let currentPds
        try {
            currentPds = didDoc.service.filter(s => s.type === 'AtprotoPersonalDataServer')[0]
                .serviceEndpoint
        } catch (error) {
            console.error(error)
            throw new Error('Could not find a PDS in the DID document.')
        }

        const plcLogRequest = await fetch(`https://plc.directory/${usersDid}/log`)
        const plcLog = await plcLogRequest.json()
        let pdsBeforeCurrent = ''
        for (const log of plcLog) {
            try {
                const pds = log.services.atproto_pds.endpoint
                if (pds.toLowerCase() === currentPds.toLowerCase()) {
                    console.log('Found the PDS before the current one')
                    break
                }
                pdsBeforeCurrent = pds
            } catch (e) {
                console.log(e)
            }
        }
        if (pdsBeforeCurrent === '') {
            throw new Error('Could not find the PDS before the current one')
        }

        let oldAgent = new AtpAgent({service: pdsBeforeCurrent})
        safeStatusUpdate(statusUpdateHandler, `Logging you in to the old PDS: ${pdsBeforeCurrent}`)
        //Login to the old PDS
        if (twoFactorCode === null) {
            await oldAgent.login({identifier: oldHandle, password: oldPassword})
        } else {
            await oldAgent.login({
                identifier: oldHandle,
                password: oldPassword,
                authFactorToken: twoFactorCode,
            })
        }
        safeStatusUpdate(statusUpdateHandler, "Checking this isn't your current PDS")
        if (pdsBeforeCurrent === currentPds) {
            throw new Error('This is your current PDS. Login to your old account username and password')
        }

        let currentAccountStatus = await oldAgent.com.atproto.server.checkAccountStatus()
        if (!currentAccountStatus.data.activated) {
            safeStatusUpdate(statusUpdateHandler, 'All good. Your old account is not activated.')
        }
        safeStatusUpdate(statusUpdateHandler, 'Deactivating your OLD account')
        await oldAgent.com.atproto.server.deactivateAccount({})
        safeStatusUpdate(statusUpdateHandler, 'Successfully deactivated your OLD account')
    }

    /**
     * Signs the logged-in user in this.newAgent for backups with PDS MOOver. This is usually called after migrate and signPlcOperation are successful
     *
     * @param {string} didWeb
     * @returns {Promise<void>}
     */
    async signUpForBackupsFromMigration(didWeb = 'did:web:pdsmoover.com') {
        //Manually grabbing the jwt and making a call with fetch cause for the life of me I could not figure out
        //how you used @atproto/api to make a call for proxying
        const url = `${this.newAgent.serviceUrl.origin}/xrpc/com.pdsmoover.backup.signUp`

        const accessJwt = this.newAgent?.session?.accessJwt
        if (!accessJwt) {
            throw new Error('Missing access token for authorization')
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessJwt}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'atproto-proxy': `${didWeb}#repo_backup`,
            },
            body: JSON.stringify({}),
        })

        if (!res.ok) {
            let bodyText = ''
            try {
                bodyText = await res.text()
            } catch {
            }
            throw new Error(
                `Backup signup failed: ${res.status} ${res.statusText}${bodyText ? ` - ${bodyText}` : ''}`,
            )
        }

        //No return the success is all that is needed, if there's an error it will throw
    }
}

export {Migrator}
