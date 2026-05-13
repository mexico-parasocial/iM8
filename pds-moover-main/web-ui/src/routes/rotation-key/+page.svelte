<script lang="ts">
    import MooHeader from '$lib/components/MooHeader.svelte';
    import {PlcOps} from '@pds-moover/moover';
    import type {RotationKeyType} from '$lib/types';
    import RotationKeyDisplay from '$lib/components/RotationKeyDisplay.svelte';

    let handle: string = $state('');
    let errorMessage: null | string = $state(null);
    let status: null | string = $state(null);
    let newlyCreatedRotationPrivateKey: null | RotationKeyType = $state(null);


    const generateNewKey = async () => {
        errorMessage = null;
        status = 'Generating a new rotation key…';
        try {
            const plcOps = new PlcOps();
            newlyCreatedRotationPrivateKey = await plcOps.createANewSecp256k1();
            status = 'New rotation key generated.';
        } catch (e) {
            console.error(e);
            // @ts-expect-error: already checked for null
            errorMessage = e?.message || 'Failed to generate a new rotation key';
            status = null;
        }
    };

</script>


<div class="container">

    <MooHeader title="Rotation Key"/>
    <div class="section">
        <p style="text-align: left;">This page is intended for development and is not listed. This will NOT save a key
            to your account.</p>
        <div class="form-group">
            <label for="handle">Handle</label>
            <input bind:value={handle} type="text" id="handle" name="handle" placeholder="Enter your handle"/>
        </div>
        <div class="form-group">
            <button type="button" onclick={generateNewKey}>Generate New Rotation Key</button>
        </div>
    </div>

    {#if status}
        <div class="status-message">{status}</div>
    {/if}

    {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
    {/if}


    {#if newlyCreatedRotationPrivateKey}
        <RotationKeyDisplay handle={handle} rotationKey={newlyCreatedRotationPrivateKey}/>
    {/if}

</div>