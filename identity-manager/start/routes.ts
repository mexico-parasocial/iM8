import router from '@adonisjs/core/services/router'
import AnonymousController from '#controllers/anonymous_controller'
import ClaimsController from '#controllers/claims_controller'
import DocsController from '#controllers/docs_controller'
import GrantsController from '#controllers/grants_controller'
import HealthController from '#controllers/health_controller'
import IdentitiesController from '#controllers/identities_controller'
import IssuersController from '#controllers/issuers_controller'
import KarmaController from '#controllers/karma_controller'
import LedgerController from '#controllers/ledger_controller'
import ProvidersController from '#controllers/providers_controller'
import SessionsController from '#controllers/sessions_controller'

router.get('/docs', [DocsController, 'scalar'])
router.get('/openapi.json', [DocsController, 'openapi'])

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

    router.post('/identity/request', [IdentitiesController, 'request'])
    router.post('/identity/present', [IdentitiesController, 'present'])
    router.post('/identity/verify', [IdentitiesController, 'verify'])
    router.post('/identity/chat-key-backup', [IdentitiesController, 'createChatKeyBackup'])
    router.get('/identity/chat-key-backup', [IdentitiesController, 'getChatKeyBackup'])
    router.delete('/identity/chat-key-backup', [IdentitiesController, 'deleteChatKeyBackup'])
    router.post('/identity/ine/analyze', [IdentitiesController, 'ineAnalyze'])
    router.post('/identity/ine/verify', [IdentitiesController, 'ineVerify'])
    router.post('/identity/ine/credential', [IdentitiesController, 'ineCredential'])
    router.post('/identity/ine/zkp-verify', [IdentitiesController, 'zkpVerify'])
    router.post('/identity/revoke', [IdentitiesController, 'revoke'])
    router.get('/identity/crl', [IdentitiesController, 'crl'])
    router.get('/identity/ine/zkp-prover.html', [IdentitiesController, 'zkpProverHtml'])
    router.get('/identity/ine/zkp-prover.wasm', [IdentitiesController, 'zkpProverWasm'])
    router.get('/identity/ine/zkp-prover.zkey', [IdentitiesController, 'zkpProverZkey'])
    router.post('/identity/ine/zkp-nullifier', [IdentitiesController, 'zkpNullifier'])
    router.get('/identity/ine/nullifier-prover.wasm', [IdentitiesController, 'nullifierProverWasm'])
    router.get('/identity/ine/nullifier-prover.zkey', [IdentitiesController, 'nullifierProverZkey'])

    router.get('/issuers', [IssuersController, 'index'])

    router.post('/karma/earn', [KarmaController, 'earn'])
    router.get('/karma/me', [KarmaController, 'me'])
    router.get('/karma/:profileId', [KarmaController, 'show'])
    router.put('/karma/revelation', [KarmaController, 'updateRevelation'])

    router.get('/ledger', [LedgerController, 'index'])
  })
  .prefix('/v1')
