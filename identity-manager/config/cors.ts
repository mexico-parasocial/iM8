import { defineConfig } from '@adonisjs/cors'
import { env } from '../src/config/env.js'

const origin =
  env.CORS_ORIGIN === '*'
    ? true
    : env.CORS_ORIGIN.split(',')
        .map((value) => value.trim())
        .filter(Boolean)

export default defineConfig({
  enabled: true,
  origin,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  headers: ['content-type', 'authorization', 'x-m8-session-id'],
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})
