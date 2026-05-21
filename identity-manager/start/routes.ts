import router from '@adonisjs/core/services/router'
import AnonymousController from '#controllers/anonymous_controller'
import ClaimsController from '#controllers/claims_controller'
import GrantsController from '#controllers/grants_controller'
import HealthController from '#controllers/health_controller'
import ProvidersController from '#controllers/providers_controller'
import SessionsController from '#controllers/sessions_controller'

router
  .group(() => {
    router.get('/health', [HealthController, 'show'])

    router.post('/sessions/start', [SessionsController, 'start'])
    router.get('/sessions/oauth/callback', [SessionsController, 'oauthCallback'])
    router.get('/sessions/me', [SessionsController, 'me'])
    router.post('/sessions/anonymous/enable', [SessionsController, 'enableAnonymous'])
    router.post('/sessions/anonymous/disable', [SessionsController, 'disableAnonymous'])
    router.post('/sessions/refresh', [SessionsController, 'refresh'])

    router.get('/grants', [GrantsController, 'index'])
    router.post('/grants', [GrantsController, 'store'])
    router.post('/grants/:id/approve', [GrantsController, 'approve'])
    router.post('/grants/:id/revoke', [GrantsController, 'revoke'])

    router.post('/claims/:id/verify', [ClaimsController, 'verify'])
    router.get('/providers/para/status', [ProvidersController, 'paraStatus'])

    router.get('/anonymous/identities', [AnonymousController, 'identities'])
    router.post('/anonymous/identities', [AnonymousController, 'createIdentity'])
    router.patch('/anonymous/identities/:id', [AnonymousController, 'updateIdentity'])
    router.post('/anonymous/posts', [AnonymousController, 'linkPost'])
    router.patch('/anonymous/posts/:id/dm-policy', [AnonymousController, 'updatePostDmPolicy'])
    router.patch('/anonymous/posts/:id/stats', [AnonymousController, 'updatePostStats'])
    router.post('/anonymous/identities/:id/germ/link', [AnonymousController, 'linkGerm'])
    router.post('/anonymous/identities/:id/germ/unlink', [AnonymousController, 'unlinkGerm'])
    router.get('/anonymous/public-contact', [AnonymousController, 'publicContact'])
    router.get('/anonymous/public-contact/eligibility', [AnonymousController, 'publicContactEligibility'])
    router.get('/device-trust/me', [AnonymousController, 'deviceTrust'])
    router.post('/device-trust/development/verify', [AnonymousController, 'verifyDevelopmentDevice'])
  })
  .prefix('/v1')
