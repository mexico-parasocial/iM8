import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().default('0.0.0.0'),
  SERVICE_URL: z.string().url().default('http://localhost:8787'),
  DATABASE_PATH: z.string().default('./data/identity-manager.db'),
  JWT_SECRET: z.string().min(32).default(() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production')
    }
    return 'dev-secret-do-not-use-in-production-' + Date.now()
  }),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(86400),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(7),
  APP_KEY: z.string().min(16).default(() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_KEY is required in production')
    }
    return 'dev-app-key-not-for-production'
  }),
  PLC_URL: z.string().url().default('https://plc.directory'),
  PDS_URL: z.string().url().default('https://bsky.social'),
  PRIVATE_KEYS: z.string().optional(),
  COOKIE_SECRET: z.string().min(16).default(() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('COOKIE_SECRET is required in production')
    }
    return 'dev-cookie-secret-not-for-production'
  }),
  PARA_API_BASE_URL: z.string().url().optional(),
  PARA_API_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
})

export const env = envSchema.parse(process.env)
