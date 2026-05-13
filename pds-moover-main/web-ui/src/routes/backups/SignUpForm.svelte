<script lang="ts">
    import type {BackupService, PlcOps} from '@pds-moover/moover';
    import type {RotationKeyType} from '$lib/types';
    import type {InferXRPCBodyOutput} from '@atcute/lexicons';
    import {ComPdsmooverBackupGetRepoStatus} from '@pds-moover/lexicons';
    import RotationKeyDisplay from '$lib/components/RotationKeyDisplay.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

    let {
        backupService,
        plcOps,
        handle,
        onComplete
    }: {
        backupService: BackupService;
        plcOps: PlcOps;
        handle: string;
        onComplete: (
            repoStatus: InferXRPCBodyOutput<ComPdsmooverBackupGetRepoStatus.mainSchema['output']>
        ) => void;
    } = $props();

    // State variables
    let errorMessage = $state<string | null>(null);
    let showStatusMessage = $state(false);
    let statusMessageText = $state('');
    let addRecoveryKey = $state(true);
    let plcTokenInput = $state<string | null>(null);
    let newlyCreatedRotationKey = $state<RotationKeyType | null>(null);
    let showRotationKeyScreen = $state(false);
    let isRequestingToken = $state(false);
    let isSigningUp = $state(false);
    let isProceeding = $state(false);

    function updateStatusHandler(status: string) {
        console.log('Status update:', status);
        statusMessageText = status;
    }

    async function requestPlcToken() {
        errorMessage = null;
        isRequestingToken = true;
        try {
            showStatusMessage = true;
            updateStatusHandler('Requesting PLC token…');
            await backupService.requestAPlcToken();
            updateStatusHandler('PLC token emailed. Check your inbox and paste the token below.');
        } catch (e) {
            //@ts-expect-error: Error is handled
            errorMessage = e?.message || 'Failed to request PLC token';
        } finally {
            showStatusMessage = false;
            isRequestingToken = false;
        }
    }

    async function handleSignUpSubmit() {
        errorMessage = null;
        isSigningUp = true;
        showStatusMessage = true;
        try {
            if (addRecoveryKey) {
                if (!plcTokenInput) {
                    errorMessage =
                        'Please paste your PLC token. Use the "Email me a PLC token" button to request one.';
                    showStatusMessage = false;
                    isSigningUp = false;
                    return;
                }
                updateStatusHandler('Creating new rotation key…');
                const created = await plcOps.createANewSecp256k1();
                newlyCreatedRotationKey = created;
                updateStatusHandler('Adding new rotation key to your DID…');
                await backupService.addANewRotationKey(plcTokenInput, created.publicKey);
                updateStatusHandler('Rotation key added. Please save the private key now.');
                showRotationKeyScreen = true;
                showStatusMessage = false;
                isSigningUp = false;
                //Return and then on next button click we sign the user up that way if it fails it won't ruin them from
                //Getting their rotation key
                return;
            }
            await backupService.signUp(updateStatusHandler);
            updateStatusHandler('Signed up for backups successfully.');

            const repoStatus = await backupService.getUsersRepoStatus(updateStatusHandler);
            showStatusMessage = false;
            isSigningUp = false;
            onComplete(repoStatus);
        } catch (e) {
            console.error(e);
            //@ts-expect-error: Error is handled
            errorMessage = e.message || 'Failed to sign up for backups.';
            showStatusMessage = false;
            isSigningUp = false;
        }
    }

    async function proceedToRepoStatus() {
        isProceeding = true;
        try {
            await backupService.signUp(updateStatusHandler);
            updateStatusHandler('Signed up for backups successfully.');

            showStatusMessage = true;
            updateStatusHandler('Fetching repository status…');
            const repoStatus = await backupService.getUsersRepoStatus(updateStatusHandler);
            showRotationKeyScreen = false;
            showStatusMessage = false;
            isProceeding = false;
            onComplete(repoStatus);
        } catch (e) {
            console.error(e);
            //@ts-expect-error: Error is handled
            errorMessage = e?.message || 'Failed to load repository status';
            showStatusMessage = false;
            isProceeding = false;
        }
    }
</script>

{#if showRotationKeyScreen && newlyCreatedRotationKey}
    <div class="section">
        <RotationKeyDisplay {handle} rotationKey={newlyCreatedRotationKey}/>
        <div class="form-group">
            <button type="button" onclick={proceedToRepoStatus} disabled={isProceeding}>
                {#if isProceeding}
                    <LoadingSpinner/>
                {/if}
                Next
            </button>
        </div>
    </div>
{:else}
    <div class="section">
        <h2>No backup repository found</h2>
        <p style="text-align: left;">
            Sign up now to backup your AT Protocol account. PDS MOOver automatically backups your posts,
            likes, media, and all account data every 2 hours. This is stored on our servers in something
            called an <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://en.wikipedia.org/wiki/Object_storage">object store.</a
        >
            Just like your
            <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://blueskyweb.zendesk.com/hc/en-us/articles/15835264007693-Data-Privacy"
            >AT Proto data</a
            >, this data is public.
        </p>
        <div class="info">
            <h3>Critical: Save your rotation key</h3>
            <p style="text-align: left;">
                A rotation key is your account recovery key. If you've migrated to a selfhosted or
                thirdparty PDS, this key is the <span class="bold">ONLY</span> way to recover your account if
                your PDS goes down. Without it, a failed or rogue PDS means permanent account loss. Generate
                one and store it safely.
            </p>
        </div>
        <div class="form-group">
            <label style="display: inline-flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
                <input type="checkbox" bind:checked={addRecoveryKey} style="margin: 0;"/>
                <span>Create a rotation key (recommended)</span>
            </label>
        </div>
        {#if addRecoveryKey}
            <div class="form-group">
                <p>
                    To add a new rotation key, you must authorize a PLC operation. Click the button to email
                    yourself a PLC token, then paste it below.
                    <span class="bold"
                    >NOTE: Adding a new key will remove all current rotation keys except for the one created
						and the one from your PDS</span
                    >
                </p>

                <div class="actions" style="margin-bottom: 0.5rem;">
                    <button type="button" onclick={requestPlcToken} disabled={isRequestingToken}>
                        {#if isRequestingToken}
                            <LoadingSpinner/>
                        {/if}
                        Email me a PLC token
                    </button>
                </div>
                <div class="form-group">
                    <label for="plc-token">PLC token</label>
                    <input
                            type="text"
                            id="plc-token"
                            name="plc-token"
                            bind:value={plcTokenInput}
                            placeholder="Paste PLC token from email"
                            autocomplete="one-time-code"
                    />
                </div>
            </div>
        {:else}
            <div class="form-group">
                <div class="status-message" style="text-align: left;">
                    <p>
                        <span class="bold">Note:</span> a recovery key is
                        <span class="bold">required</span> to restore your account. If you're not sure what this means,
                        then it is important to check the above box and save the rotation key file given.
                    </p>
                </div>
            </div>
        {/if}
        {#if errorMessage}
            <div class="error-message">{errorMessage}</div>
        {/if}
        {#if showStatusMessage}
            <div class="status-message">{statusMessageText}</div>
        {/if}
        <div>
            <button type="button" onclick={handleSignUpSubmit} disabled={isSigningUp}>
                {#if isSigningUp}
                    <LoadingSpinner/>
                {/if}
                Sign up for backups
            </button>
        </div>
    </div>
{/if}
