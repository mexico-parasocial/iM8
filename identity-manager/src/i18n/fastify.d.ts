import type { TFunction } from './index.js'

declare module 'fastify' {
  interface FastifyRequest {
    t: TFunction
  }
}
