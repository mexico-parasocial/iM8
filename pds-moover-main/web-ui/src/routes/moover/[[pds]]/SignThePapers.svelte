<script lang="ts">
    import {Migrator, PlcOps} from '@pds-moover/moover'
    import {resolve} from '$app/paths'
    import RotationKeyDisplay from '$lib/components/RotationKeyDisplay.svelte';
    import type {RotationKeyType} from '$lib/types';
    import {env} from '$env/dynamic/public';

    let {migrator, newHandle, newPdsUrl}: { migrator: Migrator, newHandle: string, newPdsUrl: string } = $props();

    let newPds = $derived(newPdsUrl.replace('https://', ''));

    //UI State
    let errorMessage: null | string = $state(null);
    let done = $state(false);
    let plcStatus: null | string = $state(null);
    let showAdvancedPlcOptions = $state(false);
    let backupSignupMessage: null | string = $state(null);
    let backupSignupError: null | string = $state(null);

    //Input State
    let createANewRotationKey = $state(false);
    let signupForBackups = $state(false);
    let plcToken = $state('');
    let rotationKeys = $state(['', '', '', '']);
    let newlyCreatedRotationKey: RotationKeyType | null = $state(null);


    async function signPlcOperation(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
        event.preventDefault();
        try {
            plcStatus = 'Signing PLC operation...';
            backupSignupMessage = null;
            backupSignupError = null;
            // Build an additional rotation keys list (user-provided and/or newly created)
            const additionalRotationKeysToAdd: string[] = [];
            // Generate a new rotation key if requested
            if (createANewRotationKey) {

                let plcOps = new PlcOps();
                const created = await plcOps.createANewSecp256k1();
                newlyCreatedRotationKey = created; // { publicKey, privateKey }
                // Reserve the first slot for the newly created key (will appear above the PDS rotation key)
                additionalRotationKeysToAdd.push(created.publicKey);
            }
            // Append any manually entered rotation keys (non-empty)
            //TODO idk about this i need to look at it again
            for (let i = 0; i < rotationKeys.length; i++) {
                const k = (rotationKeys[i] || '').trim();
                if (k) {
                    additionalRotationKeysToAdd.push(k);
                }
            }

            //TODO nervous about this state
            await migrator.signPlcOperation(plcToken, additionalRotationKeysToAdd);
            plcStatus = 'PLC operation signed successfully! Your account has been MOOved to the new PDS.';
            done = true;

            if (signupForBackups) {
                try {
                    backupSignupMessage = 'Signing you up for automated backups...';
                    //TODO nervous about this state
                    await migrator.signUpForBackupsFromMigration(`did:web:${env.PUBLIC_XRPC_BASE}`);
                    backupSignupMessage = 'Signed up for automated backups successfully.';
                } catch (e) {
                    console.error(e);
                    //@ts-expect-error: There is a e.message, or at least a check for it
                    backupSignupError = e?.message || 'Failed to sign you up for automated backups.';
                }
            }
        } catch (error) {
            //@ts-expect-error: There is a message
            errorMessage = error.message;
            console.error(error);
        }
    }

</script>


<div class="section">
    <form onsubmit="{signPlcOperation}">
        {#if !done}
            <div>
                <h2>MOOving to <span style="text-decoration: underline">{newPds}</span></h2>
                <p>Please check your email attached to your previous account for a PLC token to enter below</p>
                <div class="form-group">
                    <label for="plc-token">PLC Token:</label>
                    <input type="text" id="plc-token" name="plc-token" bind:value={plcToken} required>
                </div>
                <p style="text-align: left">
                    Please check the boxes below if you would like to add a Rotation Key to your account and to sign up
                    for PDS MOOver's free backup service.
                    With a Rotation Key and backups if your new PDS ever goes down
                    you can recover your account and it's data. This is not required but highly recommended.</p>
                <div class="form-group">
                    <label for="rotation-key" class="moove-checkbox-label">
                        <input bind:checked={createANewRotationKey} type="checkbox" id="rotation-key"
                               name="rotation-key">
                        <span>Create and add a new Rotation Key</span>
                    </label>
                </div>
                <div class="form-group">
                    <label for="backups-signup" class="moove-checkbox-label">
                        <input bind:checked={signupForBackups} type="checkbox" id="backups-signup"
                               name="backups-signup">
                        <span>Signup for automated account backups</span>
                    </label>
                </div>
                <div class="form-group">
                    <button type="button" id="plc-advance"
                            onclick={() => showAdvancedPlcOptions = !showAdvancedPlcOptions}>Add
                        Additional Rotation Keys
                    </button>
                </div>
                {#if showAdvancedPlcOptions}
                    <div class="section" style="padding-bottom: 10px;">
                        <div style="text-align: left;">
                            You can pick up to 4 rotation keys to your PLC document. These will appear above your new
                            PDS
                            rotation key so you can recover your account in the event of an adversarial take over from a
                            rogue PDS
                        </div>
                        <div class="form-group" style="margin-top: 10px;">
                            <label for="rotation-key-1">Rotation key 1</label>
                            <input type="text" id="rotation-key-1" name="rotation-key-1"
                                   bind:value={rotationKeys[0]}
                                   disabled={createANewRotationKey}
                                   placeholder={createANewRotationKey ? 'reserved for the newly created rotation key' : ''}>
                        </div>
                        <div class="form-group">
                            <label for="rotation-key-2">Rotation key 2</label>
                            <input type="text" id="rotation-key-2" name="rotation-key-2" bind:value={rotationKeys[1]}>
                        </div>
                        <div class="form-group">
                            <label for="rotation-key-3">Rotation key 3</label>
                            <input type="text" id="rotation-key-3" name="rotation-key-3" bind:value={rotationKeys[2]}>
                        </div>
                        <div class="form-group">
                            <label for="rotation-key-4">Rotation key 4</label>
                            <input type="text" id="rotation-key-4" name="rotation-key-4" bind:value={rotationKeys[3]}>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
        {#if errorMessage}
            <div class="error-message">{errorMessage}</div>
        {/if}

        {#if done && createANewRotationKey && newlyCreatedRotationKey}
            <div>
                <RotationKeyDisplay handle={newHandle} rotationKey={newlyCreatedRotationKey}/>
            </div>
        {/if}

        {#if !done && plcStatus}
            <div class="status-message">{plcStatus}</div>
        {/if}

        {#if signupForBackups && backupSignupMessage}
            <div>
                <div class="status-message">{backupSignupMessage}</div>
                {#if backupSignupError}
                    <div class="error-message">{backupSignupError}</div>
                {/if}

            </div>
        {/if}

        {#if done}
            <div class="status-message">Congratulations! You have MOOved to <strong>{newPdsUrl}</strong>! Remember to
                use
                your new PDS URL under "Hosting provider" when logging in on Bluesky. If you cannot login or see "Your
                account is deactivated" please follow the directions
                <a href={resolve('/info#cant-login')}>here.</a></div>
        {:else }
            <div>
                <button type="submit">Sign the papers</button>
            </div>
        {/if}


    </form>
</div>
