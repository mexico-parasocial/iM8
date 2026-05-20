import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'
import { env } from '../src/config/env.js'

export const appKey = env.APP_KEY
export const appUrl = env.SERVICE_URL

export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,
  useAsyncLocalStorage: false,
  redirect: {
    forwardQueryString: true,
  },
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
