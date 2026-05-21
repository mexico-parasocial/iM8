import type { HttpContext } from '@adonisjs/core/http'
import { TRUSTED_ISSUERS } from '../../src/services/identityWallet.js'

export default class IssuersController {
  index({ response }: HttpContext) {
    return response.send(TRUSTED_ISSUERS)
  }
}
