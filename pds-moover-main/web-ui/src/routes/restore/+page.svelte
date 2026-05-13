<script lang="ts">
    import {Restore} from '@pds-moover/moover';
    import MooHeader from '$lib/components/MooHeader.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import Captcha from '$lib/components/Captcha.svelte';
    import {env} from '$env/dynamic/public';
    import OgImage from '$lib/components/OgImage.svelte';
    import {Client, simpleFetchHandler} from '@atcute/client';
    import type {} from '@atcute/atproto';
    import type {ComAtprotoServerDescribeServer} from '@atcute/atproto';


    let {data} = $props();

    //Regexs to catch rotation key type
    const HEX_REGEX = /^[0-9a-f]+$/i;

    // Service instances
    let restoreService = $state(new Restore(`https://${env.PUBLIC_XRPC_BASE}`));

    // Form inputs
    let currentHandle = $state('');
    let rotationKey = $state('');
    let newPds = $state('');
    let newHandle = $state('');
    let newPassword = $state('');
    let newEmail = $state('');
    let inviteCode = $state('');
    let cid = $state('');

    // Rotation key type detection and selection
    let isHexKey = $state(false);
    let rotationKeyType = $state<'secp256k1' | 'p256'>('secp256k1');

    // Advanced options
    let restoreFilesFromBackup = $state(true);
    let recoverAccount = $state(true);

    // UI state
    let errorMessage = $state<string | null>(null);
    let showStatusMessage = $state(false);
    let showAdvanced = $state(false);
    let done = $state(false);
    let statusMessageText = $state('');
    let isSubmitting = $state(false);

    // Captcha state
    let showCaptcha = $state(false);
    let verificationCode = $state<string | null>(null);
    let pdsOptions = $state<ComAtprotoServerDescribeServer.$output | null>(null);

    function extractHostname(url: string): string | null {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }
    
    // Watch newPds input and auto-fetch describeServer for allowed PDS hosts
    $effect(() => {
        const hostname = extractHostname(newPds);
        console.log('New PDS hostname:', hostname);
        if (!hostname || !data.allowedPds.includes(hostname.toLowerCase())) {
            pdsOptions = null;
            return;
        }
        const pdsUrl = `https://${hostname}`;
        const handler = simpleFetchHandler({service: pdsUrl});
        const rpc = new Client({handler});
        rpc.get('com.atproto.server.describeServer', {}).then((res) => {
            if (!res.ok) return;
            pdsOptions = res.data;
        }).catch((e) => {
            console.error('Failed to describe PDS', e);
        });
    });

    const captchaVerificationRequired = $derived(pdsOptions?.phoneVerificationRequired === true);
    const cleanPdsHostname = $derived(extractHostname(newPds));

    function setStatus(message: string) {
        console.log('Status update:', message);
        statusMessageText = message;
        showStatusMessage = true;
    }

    function handleRotationKeyChange() {
        const trimmedKey = rotationKey.trim();
        if (trimmedKey && HEX_REGEX.test(trimmedKey)) {
            isHexKey = true;
        } else {
            isHexKey = false;
        }
    }

    function handleCaptchaSuccess(code: string) {
        verificationCode = code;
        showCaptcha = false;
        performRestore();
    }

    function handleCaptchaError(error: string) {
        errorMessage = `Verification failed: ${error}`;
        isSubmitting = false;
    }

    async function handleSubmit() {
        errorMessage = null;
        showStatusMessage = false;
        isSubmitting = true;

        if (captchaVerificationRequired && recoverAccount && !verificationCode) {
            showCaptcha = true;
            return;
        }

        await performRestore();
    }

    async function performRestore() {
        try {
            restoreService.RestoreFromBackup = restoreFilesFromBackup;
            restoreService.AccountRecovery = recoverAccount;

            await restoreService.recover(
                rotationKey,
                rotationKeyType,
                currentHandle,
                newPds,
                newHandle,
                newPassword,
                newEmail,
                inviteCode || null,
                cid || null,
                verificationCode,
                setStatus
            );
            done = true;
        } catch (e) {
            console.error(e);
            // @ts-expect-error: Error is handled
            errorMessage = e.message || 'An error occurred';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>PDS MOOver - Restore</title>
    <meta property="og:description" content="Recovery and restore your ATProto account"/>
    <OgImage/>
</svelte:head>

<div class="container">
    <MooHeader title="Restore"/>

    <div class="section">
        <p style="text-align: left">
            Use this page to restore your AT Protocol account on a new PDS using your private rotation
            key. It's intended to be used in the worst case scenario, and not for normal account
            migrations. We do not need your password since your rotation key is what is used to recover
            your account. Once your account has been moved to a new PDS we will also attempt to restore
            your repo and blobs(pictures/videos) from our backups.
        </p>
    </div>

    {#if !done}
        {#if showCaptcha}
            <Captcha
                    pdsUrl={`https://${cleanPdsHostname}`}
                    handle={newHandle}
                    onSuccess={handleCaptchaSuccess}
                    onError={handleCaptchaError}
            />
        {:else}
            <form
                    id="restore-form"
                    onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
            >
                <div class="form-group">
                    <label for="current-handle"
                    >Your current handle or did (found in the recovery rotation-key.txt)</label
                    >
                    <input
                            id="current-handle"
                            bind:value={currentHandle}
                            placeholder="did:plc:rnpkyqnmsw4ipey6eotbdnnf"
                            required
                    />
                </div>

                {#if recoverAccount}
                    <div class="form-group">
                        <label for="rotationKey">Private Rotation Key</label>
                        <input
                                id="rotationKey"
                                bind:value={rotationKey}
                                oninput={handleRotationKeyChange}
                                placeholder="a secp256k1 or p256 in either hex or multikey format"
                                required={recoverAccount}
                        />
                    </div>

                    {#if isHexKey}
                        <div class="form-group">
                            <fieldset style="border: none; padding: 0; margin: 0;">
                                <legend style="margin-bottom: 0.5rem;">Rotation Key Type</legend>
                                <div style="display: flex; gap: 1rem;">
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                        <input
                                                type="radio"
                                                name="rotationKeyType"
                                                value="secp256k1"
                                                bind:group={rotationKeyType}
                                        />
                                        secp256k1
                                    </label>
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                        <input
                                                type="radio"
                                                name="rotationKeyType"
                                                value="p256"
                                                bind:group={rotationKeyType}
                                        />
                                        p256
                                    </label>
                                </div>
                                <small class="help-text">Select the type of your hex-encoded rotation key</small>
                            </fieldset>
                        </div>
                    {/if}
                {/if}

                <div class="form-group">
                    <label for="newPds">New PDS</label>
                    <input
                            id="newPds"
                            type="text"
                            bind:value={newPds}
                            placeholder="https://newpds.com"
                            required
                    />
                </div>

                <div class="form-group">
                    <label for="newHandle">New Handle</label>
                    <input
                            id="newHandle"
                            type="text"
                            bind:value={newHandle}
                            placeholder="you.newpds.com or thisisme.com"
                            required
                    />
                </div>

                <div class="form-group">
                    <label for="newPassword">New Password</label>
                    <input id="newPassword" type="password" bind:value={newPassword} required/>
                </div>

                <div class="form-group">
                    <label for="newEmail">New Email</label>
                    <input
                            id="newEmail"
                            type="email"
                            bind:value={newEmail}
                            placeholder="you@example.com"
                            required
                    />
                </div>

                <div class="form-group">
                    <label for="inviteCode">Invite code (optional)</label>
                    <input id="inviteCode" type="text" bind:value={inviteCode} placeholder="Optional"/>
                </div>

                <div class="form-group">
                    <button type="button" onclick={() => (showAdvanced = !showAdvanced)}>
                        {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
                    </button>
                </div>

                {#if showAdvanced}
                    <div class="advanced-options">
                        <div class="form-group">
                            <label class="moove-checkbox-label">
                                <input
                                        id="recoverAccount"
                                        type="checkbox"
                                        bind:checked={recoverAccount}
                                />
                                Recover the did doc & account.
                            </label>
                            <br/>
                            <small class="help-text">This option temporary assigns a signing key to your did doc, uses
                                it to
                                create a new account on the new PDS with your did, and migrates the account to the new
                                PDS.</small>
                        </div>

                        <div class="form-group">
                            <label class="moove-checkbox-label">
                                <input
                                        id="restoreFilesFromBackup"
                                        type="checkbox"
                                        bind:checked={restoreFilesFromBackup}
                                />
                                Restores files from backup.
                            </label>
                        </div>

                        {#if recoverAccount}
                            <div class="form-group">
                                <label for="cid">Cid (optional)</label>
                                <input
                                        id="cid"
                                        type="text"
                                        bind:value={cid}
                                        placeholder="Specific PLC audit log CID to restore to (advanced)"
                                />
                                <small class="help-text"
                                >Leave empty for normal restore. IF someone besides you changed your did doc and
                                    stole your atproto identity or a mistake was made you have up to 72hrs to reverse
                                    that
                                    change with a valid
                                    rotation key from the last valid operation. This input allows you to restore to the
                                    last good PLC op via it's
                                    CID.</small
                                >
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if errorMessage}
                    <div class="error-message">{errorMessage}</div>
                {/if}
                {#if showStatusMessage}
                    <div class="status-message">{statusMessageText}</div>
                {/if}

                <div class="form-actions">
                    <button type="submit" disabled={isSubmitting}>
                        {#if isSubmitting}
                            <LoadingSpinner/>
                        {/if}
                        Recover and restore your account
                    </button>
                </div>
            </form>
        {/if}
    {/if}

    <!-- Done -->
    {#if done}
        <div class="section">
            <div class="status-message">
                Congratulations! You have successfully recovered your account! Remember to use your new
                PDS URL under "Hosting provider" when logging in on Bluesky. Can find more detail
                information
                <a href="/info#cant-login">here.</a>
            </div>
        </div>
    {/if}
</div>
