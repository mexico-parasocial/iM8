import { AtpAgent } from '@atproto/api'
import { handleAndPDSResolver } from './atprotoUtils.js'

/**
 * Class to help find missing blobs from the did's previous PDS and import them into the current PDS
 */
class MissingBlobs {
  constructor() {
    /**
     * The user's current PDS agent
     * @type {AtpAgent}
     */
    this.currentPdsAgent = null
    /**
     * The user's old PDS agent
     * @type {AtpAgent}
     */
    this.oldPdsAgent = null
    /**
     * the user's did
     * @type {string|null}
     */
    this.did = null
    /**
     * The user's current PDS url
     * @type {null}
     */
    this.currentPdsUrl = null
    /**
     * A list of the missing cids blobs from the old PDS. In this case if a retry upload fails it gets put in this array for the ui
     * @type {string[]}
     */
    this.missingBlobs = []
  }

  /**
   * Logs the user into the current PDS and gets the account status
   * @param handle {string}
   * @param password {string}
   * @param twoFactorCode {string|null}
   * @returns {Promise<{accountStatus: OutputSchema, missingBlobsCount: number}>}
   */
  async currentAgentLogin(handle, password, twoFactorCode = null) {
    let { usersDid, pds } = await handleAndPDSResolver(handle)
    this.did = usersDid
    this.currentPdsUrl = pds
    const agent = new AtpAgent({
      service: pds,
    })

    if (twoFactorCode === null) {
      await agent.login({ identifier: usersDid, password })
    } else {
      await agent.login({
        identifier: usersDid,
        password: password,
        authFactorToken: twoFactorCode,
      })
    }

    this.currentPdsAgent = agent

    const result = await agent.com.atproto.server.checkAccountStatus()
    const missingBlobs = await this.currentPdsAgent.com.atproto.repo.listMissingBlobs({
      limit: 10,
    })
    return { accountStatus: result.data, missingBlobsCount: missingBlobs.data.blobs.length }
  }

  /**
   * Logs into the old PDS and gets the account status.
   * Does not need a handle
   * since it is assumed the user has already logged in with the current PDS and we are using their did
   * @param password {string}
   * @param twoFactorCode {string|null}
   * @param pdsUrl {string|null} - If you know the url of the old PDS you can pass it in here. If not it will be guessed at from plc ops
   * @returns {Promise<void>}
   */
  async oldAgentLogin(password, twoFactorCode = null, pdsUrl = null) {
    let oldPds = null

    if (pdsUrl === null) {
      const response = await fetch(`https://plc.directory/${this.did}/log`)
      let auditLog = await response.json()
      auditLog = auditLog.reverse()
      let debugCount = 0
      for (const entry of auditLog) {
        console.log(`Loop: ${debugCount++}`)
        console.log(entry)
        if (entry.services) {
          if (entry.services.atproto_pds) {
            if (entry.services.atproto_pds.type === 'AtprotoPersonalDataServer') {
              const pds = entry.services.atproto_pds.endpoint
              console.log(`Found PDS: ${pds}`)
              if (pds.toLowerCase() !== this.currentPdsUrl.toLowerCase()) {
                oldPds = pds
                break
              }
            }
          }
        }
      }
      if (oldPds === null) {
        throw new Error('Could not find your old PDS')
      }
    } else {
      oldPds = pdsUrl
    }

    const agent = new AtpAgent({
      service: oldPds,
    })

    if (twoFactorCode === null) {
      await agent.login({ identifier: this.did, password })
    } else {
      await agent.login({
        identifier: this.did,
        password: password,
        authFactorToken: twoFactorCode,
      })
    }
    this.oldPdsAgent = agent
  }

  /**
   * Gets the missing blobs from the old PDS and uploads them to the current PDS
   * @param statusUpdateHandler {function} - A function to update the status of the migration. This is useful for showing the user the progress of the migration
   * @returns {Promise<{accountStatus: OutputSchema, missingBlobsCount: number}>}
   */
  async migrateMissingBlobs(statusUpdateHandler) {
    if (this.currentPdsAgent === null) {
      throw new Error('Current PDS agent is not set')
    }
    if (this.oldPdsAgent === null) {
      throw new Error('Old PDS agent is not set')
    }
    statusUpdateHandler('Starting to import blobs...')

    let totalMissingBlobs = 0
    let missingBlobCursor = undefined
    let missingUploadedBlobs = 0

    do {
      const missingBlobs = await this.currentPdsAgent.com.atproto.repo.listMissingBlobs({
        cursor: missingBlobCursor,
        limit: 1000,
      })
      totalMissingBlobs += missingBlobs.data.blobs.length

      for (const recordBlob of missingBlobs.data.blobs) {
        try {
          const blobRes = await this.oldPdsAgent.com.atproto.sync.getBlob({
            did: this.did,
            cid: recordBlob.cid,
          })
          let result = await this.currentPdsAgent.com.atproto.repo.uploadBlob(blobRes.data, {
            encoding: blobRes.headers['content-type'],
          })

          if (result.status === 429) {
            statusUpdateHandler(
              `You are being rate limited. Will need to try again later to get the rest of the blobs. Migrated blobs: ${missingUploadedBlobs}/${totalMissingBlobs}`,
            )
          }

          if (missingUploadedBlobs % 2 === 0) {
            statusUpdateHandler(
              `Migrating blobs: ${missingUploadedBlobs}/${totalMissingBlobs} (The total may increase as we find more)`,
            )
          }
          missingUploadedBlobs++
        } catch (error) {
          console.error(error)
          this.missingBlobs.push(recordBlob.cid)
        }
      }
      missingBlobCursor = missingBlobs.data.cursor
    } while (missingBlobCursor)

    const accountStatus = await this.currentPdsAgent.com.atproto.server.checkAccountStatus()
    const missingBlobs = await this.currentPdsAgent.com.atproto.repo.listMissingBlobs({
      limit: 10,
    })
    return { accountStatus: accountStatus.data, missingBlobsCount: missingBlobs.data.blobs.length }
  }
}

export { MissingBlobs }
