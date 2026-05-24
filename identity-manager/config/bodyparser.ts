import { defineConfig } from '@adonisjs/core/bodyparser'
import env from '#start/env'

export default defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  form: {
    convertEmptyStringsToNull: true,
    types: ['application/x-www-form-urlencoded'],
    limit: env.get('JSON_BODY_MAX_SIZE'),
  },
  json: {
    convertEmptyStringsToNull: true,
    types: ['application/json', 'application/json-patch+json', 'application/vnd.api+json'],
    limit: env.get('JSON_BODY_MAX_SIZE'),
  },
  multipart: {
    autoProcess: true,
    convertEmptyStringsToNull: true,
    processManually: [],
    limit: '20mb',
    types: ['multipart/form-data'],
  },
})
