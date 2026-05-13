<script lang="ts">
    import {BackupService, PlcOps} from '@pds-moover/moover';
    import MooHeader from '$lib/components/MooHeader.svelte';
    import SignUpForm from './SignUpForm.svelte';
    import RepoStatus from './RepoStatus.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import type {InferXRPCBodyOutput} from '@atcute/lexicons';
    import {ComPdsmooverBackupGetRepoStatus} from '@pds-moover/lexicons';
    import {env} from '$env/dynamic/public';


    // Service instances
    let backupService = $state(new BackupService(`did:web:${env.PUBLIC_XRPC_BASE}`));
    let plcOps = $state(new PlcOps());

    // State variables
    let handle = $state('');
    let password = $state('');
    let twoFactorCode = $state('');
    let showTwoFactorCodeInput = $state(false);
    let errorMessage = $state<string | null>(null);
    let showStatusMessage = $state(false);
    let showLoginScreen = $state(true);
    let showRepoNotFoundScreen = $state(false);
    let repoStatus = $state<null | InferXRPCBodyOutput<
        ComPdsmooverBackupGetRepoStatus.mainSchema['output']
    >>(null);
    let statusMessageText = $state('');
    let isLoggingIn = $state(false);

    function updateStatusHandler(status: string) {
        console.log('Status update:', status);
        statusMessageText = status;
    }

    async function handleLoginSubmit() {
        errorMessage = null;
        showStatusMessage = false;
        isLoggingIn = true;

        try {
            if (showTwoFactorCodeInput && !twoFactorCode) {
                errorMessage = 'Please enter the 2FA that was sent to your email.';
                isLoggingIn = false;
                return;
            }
            statusMessageText = 'Logging in...';
            showStatusMessage = true;
            const result = await backupService.loginAndStatus(
                handle,
                password,
                updateStatusHandler,
                twoFactorCode
            );
            if (result === null) {
                showRepoNotFoundScreen = true;
                showLoginScreen = false;
                showStatusMessage = false;
            } else {
                repoStatus = result;
                showLoginScreen = false;
                showStatusMessage = false;
            }
        } catch (e) {
            console.error(e);
            showStatusMessage = false;
            //@ts-expect-error: Error is handled
            if (e.error === 'AuthFactorTokenRequired') {
                showTwoFactorCodeInput = true;
                errorMessage = 'Two-factor code required. Check your email and enter the code.';
            } else {
                //@ts-expect-error: Error is handled
                errorMessage = e.message || 'An unexpected error occurred.';
            }
        } finally {
            isLoggingIn = false;
        }
    }

    function handleSignUpComplete(
        status: InferXRPCBodyOutput<ComPdsmooverBackupGetRepoStatus.mainSchema['output']>
    ) {
        repoStatus = status;
        showRepoNotFoundScreen = false;
        showLoginScreen = false;
    }
</script>

<svelte:head>
    <title>PDS MOOver - Backups</title>
    <meta property="og:description" content="PDS MOOver backups"/>
    <meta property="og:image" content="/halloween_moover.webp"/>
</svelte:head>

<div class="container">
    <MooHeader title="Backups"/>

    <!-- Login Screen -->
    {#if showLoginScreen}
        <div class="section" style="text-align: left;">
            <p>
                PDS MOOver can provide worry-free backups of your AT Protocol account. This is a free
                service for individual accounts and stores the backups on PDS MOOver's servers. Just like
                your <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy"
            >AT Proto data</a
            >, this is also public. On login, you will be asked if you'd like to add a rotation key to
                your account. A rotation key is a recovery key that allows you to restore your account if
                your PDS ever goes down. If you're already signed up for backups, then you can log in here
                to manage them.
            </p>
        </div>

        <form
                id="backup-signup-form"
                onsubmit={(e) => {
				e.preventDefault();
				handleLoginSubmit();
			}}
        >
            <div class="section">
                <h2>Sign in to your account</h2>
                <div class="form-group">
                    <label for="handle">Handle</label>
                    <input
                            type="text"
                            id="handle"
                            name="handle"
                            placeholder="alice.bsky.social"
                            bind:value={handle}
                            required
                    />
                </div>

                <div class="form-group">
                    <label for="password">Real Password</label>
                    <input type="password" id="password" name="password" bind:value={password} required/>
                    <p>
                        If you are signing up and adding a rotation key you have to use your account's real
                        password. If you are just managing your backups or have your own rotation key you can use
                        an app password
                    </p>
                </div>

                {#if showTwoFactorCodeInput}
                    <div class="form-group">
                        <label for="two-factor-code">Two-factor code (email)</label>
                        <input
                                type="text"
                                id="two-factor-code"
                                name="two-factor-code"
                                bind:value={twoFactorCode}
                        />
                        <div class="error-message">Enter the 2FA code from your email.</div>
                    </div>
                {/if}
            </div>

            {#if errorMessage}
                <div class="error-message">{errorMessage}</div>
            {/if}
            {#if showStatusMessage}
                <div class="status-message">{statusMessageText}</div>
            {/if}
            <div>
                <button type="submit" disabled={isLoggingIn}>
                    {#if isLoggingIn}
                        <LoadingSpinner/>
                    {/if}
                    Login for backups
                </button>
            </div>
        </form>
    {/if}

    <!-- Sign Up Screen -->
    {#if showRepoNotFoundScreen}
        <SignUpForm {backupService} {plcOps} {handle} onComplete={handleSignUpComplete}/>
    {/if}

    <!-- Repo Status View -->
    {#if repoStatus && !showLoginScreen && !showRepoNotFoundScreen}
        <RepoStatus {backupService} bind:repoStatus/>
    {/if}
</div>
