import { Client, CredentialManager, ok } from '@atcute/client'
import { handleAndPDSResolver } from './atprotoUtils.js'
//Shows as unused, but is used in the return types
import { ComPdsmooverBackupDescribeServer } from '@pds-moover/lexicons'

/**
 * JSDoc type-only import to avoid runtime import errors in the browser.
 * @typedef {import('@atcute/lexicons').InferXRPCBodyOutput} InferXRPCBodyOutput
 */

/**
 * Logic to sign up and manage backups for pdsmoover.com (or your own selfhosted instance)
 */
class BackupService {
  /**
   *
   * @param backupDidWeb {string} - The did:web for the xrpc service for backups, defaults to did:web:pdsmoover.com
   */
  constructor(backupDidWeb = 'did:web:pdsmoover.com') {
    /**
     *
     * @type {Client}
     */
    this.atCuteClient = null
    /**
     *
     * @type {CredentialManager}
     */
    this.atCuteCredentialManager = null

    /**
     * The did:web for the xrpc service for backups, defaults to pdsmoover.com
     * @type {string}
     */
    this.backupDidWeb = backupDidWeb
  }

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
  async loginAndStatus(identifier, password, onStatus = null, twoFactorCode = null) {
    let { pds } = await handleAndPDSResolver(identifier)

    const manager = new CredentialManager({
      service: pds,
    })

    const rpc = new Client({
      handler: manager,
      proxy: {
        did: this.backupDidWeb,
        serviceId: '#repo_backup',
      },
    })

    try {
      if (onStatus) onStatus('Signing in…')

      let loginInput = {
        identifier,
        password,
      }
      if (twoFactorCode) {
        loginInput.code = twoFactorCode
      }
      await manager.login(loginInput)

      // Make the client/manager available regardless of repo status so we can sign up if needed.
      this.atCuteClient = rpc
      this.atCuteCredentialManager = manager

      if (onStatus) onStatus('Checking backup status')
      const result = await rpc.get('com.pdsmoover.backup.getRepoStatus', {
        params: {
          did: manager.session.did.toString(),
        },
      })
      if (result.ok) {
        return result.data
      } else {
        switch (result.data.error) {
          case 'RepoNotFound':
            return null
          default:
            throw result.data.error
        }
      }
    } catch (err) {
      throw err
    }
  }

  /**
   * Signs the user up for backups with the service
   * @param onStatus
   * @returns {Promise<void>}
   */
  async signUp(onStatus = null) {
    if (!this.atCuteClient || !this.atCuteCredentialManager) {
      throw new Error('Not signed in')
    }
    if (onStatus) onStatus('Creating backup registration…')
    await ok(
      this.atCuteClient.post('com.pdsmoover.backup.signUp', {
        as: null,
      }),
    )
    if (onStatus) onStatus('Backup registration complete')
    //No return if successful
  }

  /**
   * Requests a PLC token to be sent to the user's email, needed to add a new rotation key
   * @returns {Promise<void>}
   */
  async requestAPlcToken() {
    if (!this.atCuteClient || !this.atCuteCredentialManager) {
      throw new Error('Not signed in')
    }
    const rpc = new Client({
      handler: this.atCuteCredentialManager,
    })

    let response = await rpc.post('com.atproto.identity.requestPlcOperationSignature', {
      as: null,
    })
    if (!response.ok) {
      throw new Error(response.data?.message || 'Failed to request PLC token')
    }
  }

  /**
   *  Adds a new rotation to the users did document. Assumes you are already signed in.
   *
   *  WARNING: This will overwrite any existing rotation keys with the new one at the top, and the PDS key as the second one
   * @param plcToken {string} - PLC token from the user's email that was sent from requestAPlcToken
   * @param rotationKey {string} - The new rotation key to add to the user's did document
   * @returns {Promise<void>}
   */
  async addANewRotationKey(plcToken, rotationKey) {
    if (!this.atCuteClient || !this.atCuteCredentialManager) {
      throw new Error('Not signed in')
    }

    const rpc = new Client({
      handler: this.atCuteCredentialManager,
    })

    let getDidCredentials = await rpc.get('com.atproto.identity.getRecommendedDidCredentials')

    if (getDidCredentials.ok) {
      const pdsProvidedRotationKeys = getDidCredentials.data.rotationKeys ?? []
      const updatedRotationKeys = [rotationKey, ...pdsProvidedRotationKeys]

      const credentials = {
        ...getDidCredentials.data,
        rotationKeys: updatedRotationKeys,
      }

      const signDocRes = await rpc.post('com.atproto.identity.signPlcOperation', {
        input: {
          token: plcToken,
          ...credentials,
        },
      })

      if (signDocRes.ok) {
        const submitDocRes = await rpc.post('com.atproto.identity.submitPlcOperation', {
          input: signDocRes.data,
          as: null,
        })

        if (!submitDocRes.ok) {
          throw new Error(submitDocRes.data?.message || 'Failed to submit PLC operation')
        }
      } else {
        throw new Error(signDocRes.data?.message || 'Failed to sign PLC operation')
      }
    } else {
      throw new Error(getDidCredentials.data?.message || 'Failed to get status')
    }
  }

  /**
   *
   *  Gets the current status of the user's backup repository.
   *
   * @param onStatus {function|null} - a function that takes a string used to update the UI.
   * @returns {Promise<InferXRPCBodyOutput<ComPdsmooverBackupDescribeServer.mainSchema['output']>>}
   */
  async getUsersRepoStatus(onStatus = null) {
    if (!this.atCuteClient || !this.atCuteCredentialManager) {
      throw new Error('Not signed in')
    }
    if (onStatus) onStatus('Refreshing backup status…')
    const result = await this.atCuteClient.get('com.pdsmoover.backup.getRepoStatus', {
      params: { did: this.atCuteCredentialManager.session.did.toString() },
    })
    if (result.ok) {
      return result.data
    } else {
      throw new Error(result.data?.message || 'Failed to get status')
    }
  }

  /**
   * Requests a backup to be run immediately for the signed-in user. Usually does, depend on the server's backup queue
   * @param onStatus
   * @returns {Promise<boolean>}
   */
  async runBackupNow(onStatus = null) {
    if (!this.atCuteClient || !this.atCuteCredentialManager) {
      throw new Error('Not signed in')
    }
    if (onStatus) onStatus('Requesting backup…')
    const res = await this.atCuteClient.post('com.pdsmoover.backup.requestBackup', {
      as: null,
      data: {},
    })
    if (res.ok) {
      if (onStatus) onStatus('Backup requested.')
      return true
    } else {
      const err = res.data
      if (err?.error === 'Timeout') {
        throw {
          error: 'Timeout',
          message: err?.message || 'Please wait a few minutes before requesting again.',
        }
      }
      throw new Error(err?.message || 'Failed to request backup')
    }
  }

  /**
   * Remove (delete) the signed-in user's backup repository. this also deletes all the user's backup data.
   * @param onStatus
   * @returns {Promise<boolean>}
   */
  async removeRepo(onStatus = null) {
    if (!this.atCuteClient || !this.atCuteCredentialManager) {
      throw new Error('Not signed in')
    }
    if (onStatus) onStatus('Deleting backup repository…')
    const res = await this.atCuteClient.post('com.pdsmoover.backup.removeRepo', {
      as: null,
      data: {},
    })
    if (res.ok) {
      if (onStatus) onStatus('Backup repository deleted.')
      return true
    } else {
      const err = res.data
      throw new Error(err?.message || 'Failed to delete backup repository')
    }
  }
}

export { BackupService }
