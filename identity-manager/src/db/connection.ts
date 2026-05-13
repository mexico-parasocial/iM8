import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { env } from '../config/env.js'

let dbInstance: Database.Database | null = null
let dbPath: string | null = null

export function getDb(): Database.Database {
  if (dbInstance && dbPath === env.DATABASE_PATH) return dbInstance

  if (dbInstance) {
    dbInstance.close()
  }

  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true })

  dbPath = env.DATABASE_PATH
  dbInstance = new Database(env.DATABASE_PATH)
  dbInstance.pragma('journal_mode = WAL')
  dbInstance.pragma('foreign_keys = ON')

  return dbInstance
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
    dbPath = null
  }
}

export async function resetDb(): Promise<void> {
  closeDb()
  try {
    const { unlinkSync } = await import('node:fs')
    unlinkSync(env.DATABASE_PATH)
  } catch {
    // ignore
  }
}
