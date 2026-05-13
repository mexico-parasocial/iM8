import Fastify from 'fastify'
import cors from '@fastify/cors'
import { env } from './config/env.js'
import { closeDb } from './db/connection.js'
import { ensureSchema, runMigrations } from './db/migrate.js'
import { ensureDidCacheSchema } from './services/didResolver.js'
import { registerAuth } from './middleware/auth.js'
import { registerErrorHandler } from './middleware/errorHandler.js'
import { resolveLocale, createT } from './i18n/index.js'
import { healthRoutes } from './routes/health.js'
import { sessionRoutes } from './routes/sessions.js'
import { grantRoutes } from './routes/grants.js'
import { claimRoutes } from './routes/claims.js'
import { identityRoutes } from './routes/identity.js'
import { providerRoutes } from './routes/providers.js'
import { issuerRoutes } from './routes/issuers.js'
import { ledgerRoutes } from './routes/ledger.js'
import { karmaRoutes } from './routes/karma.js'

async function buildApp() {
  ensureSchema()
  runMigrations()
  ensureDidCacheSchema()

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  })

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-m8-session-id'],
    credentials: true,
  })

  registerErrorHandler(app)
  await registerAuth(app)

  app.addHook('onRequest', async (request) => {
    const locale = resolveLocale(request.headers['accept-language'])
    request.t = createT(locale)
  })

  await app.register(healthRoutes, { prefix: '/v1' })
  await app.register(sessionRoutes, { prefix: '/v1' })
  await app.register(grantRoutes, { prefix: '/v1' })
  await app.register(claimRoutes, { prefix: '/v1' })
  await app.register(identityRoutes, { prefix: '/v1' })
  await app.register(providerRoutes, { prefix: '/v1' })
  await app.register(issuerRoutes, { prefix: '/v1' })
  await app.register(ledgerRoutes, { prefix: '/v1' })
  await app.register(karmaRoutes, { prefix: '/v1' })

  return app
}

async function main() {
  ensureSchema()
  runMigrations()
  ensureDidCacheSchema()

  const app = await buildApp()

  app.addHook('onClose', async () => {
    closeDb()
  })

  try {
    await app.listen({ port: env.PORT, host: env.HOST })
    app.log.info(`M8 Identity Manager listening on http://${env.HOST}:${env.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`)
    await app.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

if (import.meta.url.startsWith('file:') && process.argv[1] === new URL(import.meta.url).pathname) {
  main()
}

export { buildApp }
