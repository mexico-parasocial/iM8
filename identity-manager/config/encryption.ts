import { defineConfig, drivers } from '@adonisjs/core/encryption'
import { env } from '../src/config/env.js'

export default defineConfig({
  default: 'gcm',
  list: {
    gcm: drivers.aes256gcm({
      keys: [env.APP_KEY],
      id: 'gcm',
    }),
  },
})
