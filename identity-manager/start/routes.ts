import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router.get('/docs', '#controllers/docs_controller.scalar')
router.get('/openapi.json', '#controllers/docs_controller.openapi')

router
  .group(() => {
    // Public routes
    router.get('/health', '#controllers/health_controller.show')

    router.post('/sessions/start', '#controllers/sessions_controller.start')
    router.get('/sessions/oauth/callback', '#controllers/sessions_controller.oauthCallback')
    router.post('/sessions/refresh', '#controllers/sessions_controller.refresh')

    router.get('/identity/crl', '#controllers/revocation_controller.crl')
    router.get('/identity/ine/zkp-prover.html', '#controllers/zk_proof_controller.zkpProverHtml')
    router.get('/identity/ine/zkp-prover.wasm', '#controllers/zk_proof_controller.zkpProverWasm')
    router.get('/identity/ine/zkp-prover.zkey', '#controllers/zk_proof_controller.zkpProverZkey')
    router.get('/identity/ine/nullifier-prover.wasm', '#controllers/zk_proof_controller.nullifierProverWasm')
    router.get('/identity/ine/nullifier-prover.zkey', '#controllers/zk_proof_controller.nullifierProverZkey')

    router.get('/issuers', '#controllers/issuers_controller.index')

    router.get('/anonymous/public-contact', '#controllers/anonymous_controller.publicContact')

    router.get('/karma/:profileId', '#controllers/karma_controller.show')

    // Protected routes
    router
      .group(() => {
        router.get('/sessions/me', '#controllers/sessions_controller.me')
        router.post('/sessions/anonymous/enable', '#controllers/sessions_controller.enableAnonymous')
        router.post('/sessions/anonymous/disable', '#controllers/sessions_controller.disableAnonymous')

        router.get('/grants', '#controllers/grants_controller.index')
        router.post('/grants', '#controllers/grants_controller.store')
        router.post('/grants/:id/approve', '#controllers/grants_controller.approve')
        router.post('/grants/:id/revoke', '#controllers/grants_controller.revoke')

        router.post('/claims/:id/verify', '#controllers/claims_controller.verify')

        router.get('/providers/para/status', '#controllers/providers_controller.paraStatus')

        router.get('/anonymous/identities', '#controllers/anonymous_controller.identities')
        router.post('/anonymous/identities', '#controllers/anonymous_controller.createIdentity')
        router.patch('/anonymous/identities/:id', '#controllers/anonymous_controller.updateIdentity')
        router.post('/anonymous/posts', '#controllers/anonymous_controller.linkPost')
        router.patch('/anonymous/posts/:id/dm-policy', '#controllers/anonymous_controller.updatePostDmPolicy')
        router.patch('/anonymous/posts/:id/stats', '#controllers/anonymous_controller.updatePostStats')
        router.post('/anonymous/identities/:id/germ/link', '#controllers/anonymous_controller.linkGerm')
        router.post('/anonymous/identities/:id/germ/unlink', '#controllers/anonymous_controller.unlinkGerm')
        router.get('/anonymous/public-contact/eligibility', '#controllers/anonymous_controller.publicContactEligibility')
        router.get('/device-trust/me', '#controllers/anonymous_controller.deviceTrust')
        router.post('/device-trust/development/verify', '#controllers/anonymous_controller.verifyDevelopmentDevice')

        router.post('/identity/request', '#controllers/identity_wallet_controller.request')
        router.post('/identity/present', '#controllers/identity_wallet_controller.present')
        router.post('/identity/verify', '#controllers/identity_wallet_controller.verify')
        router.post('/identity/chat-key-backup', '#controllers/chat_key_backup_controller.createChatKeyBackup')
        router.get('/identity/chat-key-backup', '#controllers/chat_key_backup_controller.getChatKeyBackup')
        router.delete('/identity/chat-key-backup', '#controllers/chat_key_backup_controller.deleteChatKeyBackup')
        router.post('/identity/ine/analyze', '#controllers/ine_controller.ineAnalyze')
        router.post('/identity/ine/verify', '#controllers/ine_controller.ineVerify')
        router.post('/identity/ine/credential', '#controllers/ine_controller.ineCredential')
        router.post('/identity/ine/zkp-verify', '#controllers/zk_proof_controller.zkpVerify')
        router.post('/identity/revoke', '#controllers/revocation_controller.revoke')
        router.post('/identity/ine/zkp-nullifier', '#controllers/zk_proof_controller.zkpNullifier')
        router.post('/identity/civic-vote-proof', '#controllers/civic_vote_identity_controller.issueProof')
        router.post('/identity/civic-vote-aliases', '#controllers/civic_vote_identity_controller.linkAlias')

        router.post('/karma/earn', '#controllers/karma_controller.earn')
        router.get('/karma/me', '#controllers/karma_controller.me')
        router.put('/karma/revelation', '#controllers/karma_controller.updateRevelation')

        router.get('/ledger', '#controllers/ledger_controller.index')
      })
      .use(middleware.auth())
  })
  .prefix('/v1')
