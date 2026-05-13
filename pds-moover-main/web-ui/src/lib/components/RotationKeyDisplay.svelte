<script lang="ts">
    import {handleAndPDSResolver} from '@pds-moover/moover'
    import type {RotationKeyType} from '$lib/types';


    let {handle, rotationKey}: {
        handle: string,
        rotationKey: RotationKeyType
    } = $props();


    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert('Copied to clipboard');
        } catch (e) {
            console.error(e);
            alert('Failed to copy to clipboard');
        }
    }

    const downloadNewRotationKey = async (rotationKey: RotationKeyType, handle: string) => {
        if (!rotationKey) return;
        //try and find the did to add to the file as well
        let didText = '';
        try {
            let {usersDid} = await handleAndPDSResolver(handle);
            didText = `DID: ${usersDid}\n`;
        } catch (e) {
            //sliently log. Rather the user have their rotation key than not. a did can always be found other ways if needed
            console.error(e);
        }
        
        const content = `You can use these to recover your account if it's ever necessary via https://pdsmoover.com/restore. The restore process will ask for the Private key\n\nKEEP IN A SECURE LOCATION\n\n${didText}PublicKey: ${rotationKey.publicKey}\nPrivateKey: ${rotationKey.privateKey}\n`;
        const blob = new Blob([content], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;


        a.download = `${handle}-rotation-key.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
</script>


<div class="section" style="margin-top: 16px; border: 2px solid #f39c12; padding: 16px;">
    <h3 style="color: #d35400;">Important: Save Your New Rotation Key Now</h3>
    <p style="color: #c0392b; font-weight: bold;">
        Warning: This is the only time we will show you your private rotation key. Save it in a secure place.
        If you lose it, you may not be able to recover your account in the event of a PDS failure or hijack.
    </p>
    <div class="form-group">
        <span>New Rotation Key (Private - keep secret)</span>
        <div style="display:flex; gap:8px; align-items:center;">
            {#if rotationKey}
                <code
                        style="overflow-wrap:anywhere;">{rotationKey.privateKey}</code>
            {/if}

            <button type="button"
                    onclick={async ()  => await copyToClipboard(rotationKey.privateKey)}>Copy
            </button>
        </div>
    </div>
    <div class="form-group">
        <button type="button" onclick={async () => await downloadNewRotationKey(rotationKey, handle)}>Download
            Key File
        </button>
    </div>
</div>