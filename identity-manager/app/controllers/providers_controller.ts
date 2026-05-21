import type { HttpContext } from '@adonisjs/core/http'
import { requireSessionId } from '#support/http'
import { resolveParaProviderStatus } from '../../src/services/paraProvider.js'

export default class ProvidersController {
  async paraStatus(ctx: HttpContext) {
    if (!requireSessionId(ctx)) return
    return ctx.response.send(await resolveParaProviderStatus())
  }
}
