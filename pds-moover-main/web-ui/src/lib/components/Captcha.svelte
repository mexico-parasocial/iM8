<script lang="ts">
    import {onMount} from 'svelte';
    import { browser } from '$app/environment';

    interface CaptchaProps {
        pdsUrl: string;
        handle: string;
        onSuccess: (code: string) => void;
        onError?: (error: string) => void;
    }

    let {pdsUrl, handle, onSuccess, onError}: CaptchaProps = $props();

    function generateState(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    let captcha_state = $state(generateState());
    let iframeRef: HTMLIFrameElement | null = $state(null);
    let isLoading = $state(true);



    const gateUrl = $derived(
        `${pdsUrl}/gate/signup?state=${encodeURIComponent(captcha_state)}&handle=${encodeURIComponent(handle)}&redirect_url=${encodeURIComponent(browser ? window.location.origin : 'https://pdsmoover.com')}`,
    );

    // Monitor iframe for URL changes
    function checkIframeUrl() {
        if (!iframeRef) return;

        try {
            const iframeUrl = new URL(iframeRef.contentWindow?.location.href ?? '');

            // Check if the iframe has been redirected with code and state parameters
            // This indicates the captcha was completed
            const urlState = iframeUrl.searchParams.get('state');
            const code = iframeUrl.searchParams.get('code');

            // Only process if we have at least a state parameter (indicates redirect happened)
            if (urlState) {

                // Verify state matches
                if (urlState !== captcha_state) {
                    const stateError = 'State mismatch - possible security issue';
                    onError?.(stateError);
                    return;
                }
                if (!code) {
                    const codeError = 'No code returned from captcha';
                    onError?.(codeError);
                    return;

                }

                onSuccess(code);
            }
        } catch {
            /* empty */
        }
    }

    onMount(() => {
        // Poll for URL changes
        const interval = setInterval(checkIframeUrl, 100);

        return () => clearInterval(interval);
    });
</script>

<div class="iframe-wrapper">
    <iframe
            bind:this={iframeRef}
            src={gateUrl}
            title="Captcha Verification"
            onload={() => isLoading = false}
    ></iframe>
    {#if isLoading}
        <div class="loading-overlay">
            <p>Loading verification...</p>
        </div>
    {/if}
</div>

<style>

    .iframe-wrapper {
        position: relative;
        width: 100%;
        height: 500px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
    }

    iframe {
        width: 100%;
        height: 100%;
        border: none;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
    }

</style>
