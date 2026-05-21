import app from '@adonisjs/core/services/app'
import { ensureSchema, runMigrations } from '../src/db/migrate.js'
import { closeDb } from '../src/db/connection.js'
import { ensureDidCacheSchema } from '../src/services/didResolver.js'

ensureSchema()
runMigrations()
ensureDidCacheSchema()

app.terminating(async () => {
  closeDb()
})
