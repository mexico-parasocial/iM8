<script lang="ts">
    import MooHeader from '$lib/components/MooHeader.svelte';
    import {Migrator} from '@pds-moover/moover';
    import OgImage from '$lib/components/OgImage.svelte';

    let migrator = $state(new Migrator());

    // Form state
    let oldHandle = $state('');
    let oldPassword = $state('');
    let twoFactorCode = $state('');
    let showTwoFactorCodeInput = $state(false);
    let errorMessage: string | null = $state(null);
    let showStatusMessage = $state(false);
    let statusMessage = $state('');

    function updateStatusHandler(status: string) {
        console.log('Status update:', status);
        statusMessage = status;
    }

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault();
        errorMessage = null;
        showStatusMessage = false;


        try {
            if (showTwoFactorCodeInput) {
                if (twoFactorCode === null || twoFactorCode === '') {
                    errorMessage = 'Please enter the 2FA that was sent to your email.';
                    return;
                }
            }

            showStatusMessage = true;
            await migrator.deactivateOldAccount(
                oldHandle,
                oldPassword,
                updateStatusHandler,
                twoFactorCode
            );
        } catch (err) {
            //@ts-expect-error: error should be fine
            if (err.error === 'AuthFactorTokenRequired') {
                showTwoFactorCodeInput = true;
            }
            //@ts-expect-error: error should be fine
            errorMessage = err.message;
        }
    }
</script>

<svelte:head>
    <title>PDS MOOver - Turn OFF</title>
    <meta property="og:description" content="Deactivate your old account"/>
    <OgImage/>
</svelte:head>

<div class="container">
    <MooHeader title="Turn OFF"/>

    <p>Use this page to make sure your old account is deactivated</p>

    <form id="moover-form" onsubmit={handleSubmit}>
        <!-- Login credentials -->
        <div class="section">
            <h2>Login for your old PDS</h2>
            <div class="form-group">
                <label for="handle">Old Handle:</label>
                <input type="text" id="handle" name="handle" placeholder="alice.bsky.social"
                       bind:value={oldHandle}
                       required>
            </div>

            <div class="form-group">
                <label for="password">Old Password:</label>
                <input type="password" id="password" name="password" bind:value={oldPassword} required>
            </div>

            {#if showTwoFactorCodeInput}
                <div class="form-group">
                    <label for="two-factor-code">2FA from the email sent</label>
                    <input type="text" id="two-factor-code" name="two-factor-code" bind:value={twoFactorCode}>
                    <div class="error-message">Enter your 2fa code here</div>
                </div>
            {/if}
        </div>

        {#if errorMessage}
            <div class="error-message">{errorMessage}</div>
        {/if}
        {#if showStatusMessage}
            <div id="status-message" class="status-message">{statusMessage}</div>
        {/if}

        <div>
            <button type="submit">Turn it off</button>
        </div>
    </form>
</div>
