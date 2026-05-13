<script lang="ts">
    import MooHeader from '$lib/components/MooHeader.svelte';
    import missingPicture from '$lib/assets/missing.webp'
    import {MissingBlobs} from '@pds-moover/moover';

    let missingBlobs = $state(new MissingBlobs());

    // Form state
    let showCurrentLogin = $state(true);
    let showOldLogin = $state(false);
    let showAdvance = $state(false);
    let disableLoginButton = $state(false);
    let showBlobMoveProgress = $state(false);
    let oldPdsUrl = $state<string | null>(null);
    let showTryAgain = $state(false);
    let errorMessage: string | null = $state(null);
    let showStatusMessage = $state(false);
    let statusMessage = $state('');

    let loginForm = $state({
        handle: '',
        password: '',
        twoFactorCode: '',
        showTwoFactorCodeInput: false,
    });


    function resetStatusAndErrors() {
        showStatusMessage = false;
        statusMessage = '';
        errorMessage = '';
        disableLoginButton = true;
    }

    async function handleCurrentLogin(event: SubmitEvent) {
        event.preventDefault();
        resetStatusAndErrors();
        try {
            const {
                accountStatus,
                missingBlobsCount
            } = await missingBlobs.currentAgentLogin(loginForm.handle, loginForm.password, loginForm.twoFactorCode);
            console.log(missingBlobsCount);
            const noMissingBlobs = missingBlobsCount === 0;
            if (noMissingBlobs) {
                statusMessage = `You are good to go! You are not missing any blobs. Your account has ${accountStatus.importedBlobs} imported blobs and expects to have at least ${accountStatus.expectedBlobs} blobs. No action is required.`
            } else {
                showCurrentLogin = false;
                statusMessage = 'You are currently missing some blobs. Login with your old password to import the missing blobs. We will automatically find your old handle.';
                showOldLogin = true;
                //Reset the form
                loginForm.showTwoFactorCodeInput = false;
                loginForm.twoFactorCode = '';
                loginForm.password = '';
                loginForm.handle = '';
            }
            showStatusMessage = true;

        } catch (err) {
            //@ts-expect-error: Should always have an error message
            if (err.error === 'AuthFactorTokenRequired') {
                loginForm.showTwoFactorCodeInput = true;
            }
            //@ts-expect-error: Should always have an error message
            errorMessage = err.message;
        }
        disableLoginButton = false;
    }

    async function handleOldLogin(event: SubmitEvent) {
        event.preventDefault();
        resetStatusAndErrors();
        try {
            await missingBlobs.oldAgentLogin(loginForm.password, loginForm.twoFactorCode, oldPdsUrl);
            showOldLogin = false;
            showBlobMoveProgress = true;
            showStatusMessage = true;
            statusMessage = '';
            await migrateMissingBlobs();
        } catch (err) {
            //@ts-expect-error: Should always have an error message
            if (err.error === 'AuthFactorTokenRequired') {
                loginForm.showTwoFactorCodeInput = true;
            }
            //@ts-expect-error: Should always have an error message
            errorMessage = err.message;
        }
        disableLoginButton = false;
    }

    function updateStatusHandler(status: string) {
        console.log('Status update:', status);
        statusMessage = status;
    }

    async function migrateMissingBlobs() {
        try {
            resetStatusAndErrors();
            showStatusMessage = true;
            showTryAgain = false;
            const {
                accountStatus,
                missingBlobsCount
            } = await missingBlobs.migrateMissingBlobs(updateStatusHandler);
            const noMissingBlobs = missingBlobsCount === 0;
            if (noMissingBlobs) {
                statusMessage = `You are good to go! You have all ${accountStatus.importedBlobs} of the expected ${accountStatus.expectedBlobs} blobs. You're done!!`
            } else {
                statusMessage = `Expected blobs: ${accountStatus.expectedBlobs} Imported blobs: ${accountStatus.importedBlobs}`;
                showTryAgain = true;
            }
        } catch (err) {
            //@ts-expect-error: Should always have an error message
            errorMessage = err.message;
            showTryAgain = true;
        }
        disableLoginButton = false;
    }

    function toggleAdvanceMenu() {
        showAdvance = !showAdvance;
    }
</script>

<svelte:head>
    <title>PDS MOOver - Missing Blobs</title>
    <meta property="og:description" content="Import missing blobs from your old PDS to your new PDS"/>
    <meta property="og:image" content="{missingPicture}">
</svelte:head>

{#snippet custom_img()}
    <img src='{missingPicture}' alt='Cartoon milk cow on a missing poster'
         style='max-width: 100%; max-height: 100%; object-fit: contain;'>
{/snippet}

<div class="container">
    <MooHeader title="Missing Blobs Importer" customImg={custom_img}/>

    <a href="https://blacksky.community/profile/did:plc:g7j6qok5us4hjqlwjxwrrkjm/post/3lyylumcpok2c">How to video
        guide</a>

    <!-- Login Form -->
    {#if showCurrentLogin || showOldLogin}
        <form id="moover-form" onsubmit={showCurrentLogin ? handleCurrentLogin : handleOldLogin}>
            <div class="section">
                <h2>{showCurrentLogin ? 'Login for your current PDS' : 'Password for your OLD PDS'}</h2>

                {#if showOldLogin}
                    <p>We only need your password for your old account. We can find your old handle from your current
                        login.</p>
                {/if}

                {#if showCurrentLogin}
                    <div class="form-group">
                        <label for="handle">Current Handle:</label>
                        <input type="text" id="handle" name="handle" placeholder="alice.bsky.social"
                               bind:value={loginForm.handle}
                               required>
                    </div>
                {/if}

                <div class="form-group">
                    <label for="password">{showCurrentLogin ? 'Current' : 'OLD'} Password:</label>
                    <input type="password" id="password" name="password"
                           bind:value={loginForm.password}
                           required>
                </div>

                {#if (showCurrentLogin && loginForm.showTwoFactorCodeInput) || (showOldLogin && loginForm.showTwoFactorCodeInput)}
                    <div class="form-group">
                        <label for="two-factor-code">2FA from the email sent</label>
                        <input type="text" id="two-factor-code" name="two-factor-code"
                               bind:value={loginForm.twoFactorCode}>
                        <div class="error-message">Enter your 2fa code here</div>
                    </div>
                {/if}

                {#if showOldLogin}
                    {#if showAdvance}
                        <div class="form-group show-advance">
                            <label for="old_pds">This is optional. If you do not know your old PDS url please leave it
                                blank. We will find it for you.</label>
                            <input type="url" id="old_pds" name="old-pds"
                                   placeholder="(Optional) Your old PDS URL" bind:value={oldPdsUrl}>
                        </div>
                    {/if}
                    <div class="form-group">
                        <button type="button" onclick={toggleAdvanceMenu} id="advance" name="advance">Advance Options
                        </button>
                    </div>
                {/if}

                {#if errorMessage}
                    <div class="error-message">{errorMessage}</div>
                {/if}
                {#if showStatusMessage}
                    <div class="status-message">{statusMessage}</div>
                {/if}

                <div>
                    <button disabled={disableLoginButton} type="submit">
                        {showCurrentLogin ? 'Login' : 'Login and start the import of missing blobs'}
                    </button>
                </div>
            </div>
        </form>
    {/if}

    <!-- Progress while uploading blobs-->
    {#if showBlobMoveProgress}
        <div>
            {#if showStatusMessage}
                <div id="warning">*This will take a while. Please do not close this tab. And watch
                    the status message below for updates
                </div>
                <div id="missing-status-message" class="status-message">{statusMessage}</div>
            {/if}
            {#if errorMessage}
                <div class="error-message">{errorMessage}</div>
            {/if}
            {#if showTryAgain}
                <p style="color: yellow">We were unable to import all of your previous blobs, please try again. If it is
                    still not completing give it a few hours and come back and try again. It may be rate limited. Re
                    running this tool does not harm your account.</p>
                <br>
                <button onclick={migrateMissingBlobs}>Try again</button>
            {/if}
        </div>
    {/if}
</div>
