import { defineConfig, syncDestination, targets } from '@adonisjs/core/logger'
import app from '@adonisjs/core/services/app'
import { env } from '../src/config/env.js'

export default defineConfig({
  default: 'app',
  loggers: {
    app: {
      enabled: true,
      name: 'm8-identity-manager',
      level: env.LOG_LEVEL,
      destination: !app.inProduction ? await syncDestination() : undefined,
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
    },
  },
})
