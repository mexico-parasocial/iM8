import type { FastifyInstance } from 'fastify'

export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((err, _request, reply) => {
    fastify.log.error(err)

    const error = err as Error & { validation?: boolean; statusCode?: number; code?: string }

    if (error.validation) {
      return reply.status(400).send({
        error: _request.t('errors.validation.validationError'),
        message: error.message,
        code: 'VALIDATION_ERROR',
      })
    }

    const statusCode = error.statusCode ?? 500
    return reply.status(statusCode).send({
      error: error.message || _request.t('errors.internal.internalError'),
      code: error.code || 'INTERNAL_ERROR',
    })
  })

  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: request.t('errors.internal.notFound'), code: 'NOT_FOUND' })
  })
}
