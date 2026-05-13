<script lang="ts">
    import MooHeader from '$lib/components/MooHeader.svelte';
    import OgImage from '$lib/components/OgImage.svelte';
    import {resolve} from '$app/paths';
    import {Migrator} from '@pds-moover/moover';
    import SignThePapers from './SignThePapers.svelte';
    import Captcha from '$lib/components/Captcha.svelte';
    import {Client, simpleFetchHandler} from '@atcute/client';
    import type {} from '@atcute/atproto';


    let {data} = $props();

    let pdsOverride = $state<null | typeof data.pdsOptions>(null);
    let selectedPds = $derived(pdsOverride ?? data.pdsOptions);
    let cleanSelectedPds = $derived(selectedPds?.did.replace('did:web:', ''));
    //Kept as a "global" state to handle logic of passing the full handle that is used to SignThePapers
    let newHandle = $state('');

    let selectedDomain = $state(data.intinalDomain);

    let handlePlaceHolder = $derived(
        selectedPds ? `username${selectedDomain === 'custom' ? '' : `${selectedPds?.availableUserDomains[0]}`} or mydomain.com` : 'username.newpds.com or mycooldomain.com')


    function extractHostname(url: string): string | null {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    // Watch the newPds input and auto-fetch describeServer for allowed PDS hosts
    $effect(() => {
        const possiblePdsUrl = formData.newPds;
        // Only run when no PDS was already resolved via URL param
        if (data.pdsOptions) return;

        const hostname = extractHostname(possiblePdsUrl);
        if (!hostname || !data.allowedPds.includes(hostname.toLowerCase())) return;
        const pdsUrl = `https://${hostname}`;
        const handler = simpleFetchHandler({service: pdsUrl});
        const rpc = new Client({handler});
        rpc.get('com.atproto.server.describeServer', {}).then((res) => {
            if (!res.ok) return;
            pdsOverride = res.data;
            selectedDomain = res.data?.availableUserDomains?.[0] ?? '';
        }).catch((e) => {
            console.error('Failed to describe PDS', e);
        });
    });

    $effect(() => {
        if (!selectedPds) return;

        if (selectedDomain == 'custom') return;


        if (formData.newHandle.includes('.')) {
            // When a period is typed, force custom domain selection
            selectedDomain = 'custom';
        } else {
            // If user clears the dot and we have provider domains, fall back to first option
            if ((selectedPds?.availableUserDomains?.length ?? 0) > 0 && selectedDomain === 'custom') {
                selectedDomain = selectedPds!.availableUserDomains[0]!
            }
        }
    });

    let formData = $state({
        handle: '',
        password: '',
        newPds: '',
        newEmail: '',
        newHandle: '',
        inviteCode: null,
        twoFactorCode: null,
        verificationCode: null,
        confirmation: false,
        // Acceptance of provider policies (when required by selected PDS)
        acceptPolicies: false,
        // Advanced options
        createNewAccount: true,
        migrateRepo: true,
        migrateBlobs: true,
        migrateMissingBlobs: true,
        migratePrefs: true,
        migratePlcRecord: true,
        sourcePdsUrl: '',
    });

    let migrator = $state(new Migrator());

    //UI state
    let showTwoFactorCodeInput = $state(false);
    let showAdvance = $state(false);
    let showStatusMessage = $state(false);
    let askForPlcToken = $state(false);
    let disableSubmit = $state(false);
    let showCaptcha = $state(false);
    let migrationInProgress = $state(false);

    let errorMessage: null | string = $state(null);
    let statusMessage: null | string = $state(null);

    // Links that may require acceptance prior to migration from the selected PDS
    const privacyUrl = $derived(selectedPds?.links?.privacyPolicy);
    const tosUrl = $derived(selectedPds?.links?.termsOfService);
    const requiresAccept = $derived(!!(privacyUrl || tosUrl));

    // Check if phone verification is required
    const captchaVerificationRequired = $derived(selectedPds?.phoneVerificationRequired === true);

    const updateStatusHandler = (status: string) => {
        statusMessage = status;
    }

    function handleCaptchaSuccess(code: string) {
        formData.verificationCode = code;
        showCaptcha = false;
        // Continue with the migration
        performMigration();
    }

    function handleCaptchaError(error: string) {
        errorMessage = `Verification failed: ${error}`;
        disableSubmit = false;
    }

    async function submitMoove(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
        event.preventDefault();
        disableSubmit = true;
        errorMessage = null;
        showStatusMessage = false;

        if (!formData.confirmation) {
            errorMessage = 'Please confirm that you understand the risks of doing an account migration';
            disableSubmit = false;
            return;
        }

        // If the selected PDS provides policy or privacy links, require explicit acceptance
        if (requiresAccept && !formData.acceptPolicies) {
            errorMessage = 'Please review and accept the providers policies';
            disableSubmit = false;
            return;
        }
        newHandle = formData.newHandle;
        if (selectedPds) {
            //Not happy about this unwrap, but it should always have a value on a legit PDS that I know of

            formData.newPds = `https://${cleanSelectedPds!}`;
            // Combine username and selected domain for the new handle
            if (selectedDomain !== 'custom') {
                newHandle = formData.newHandle + selectedDomain;
            }
        }

        if (captchaVerificationRequired && formData.createNewAccount && !formData.verificationCode) {
            showCaptcha = true;
            return;
        }

        // Continue with migration
        await performMigration();
    }

    async function performMigration() {
        try {
            migrationInProgress = true;
            if (showTwoFactorCodeInput) {
                if (showTwoFactorCodeInput === null) {
                    errorMessage = 'Please enter the 2FA that was sent to your email.'
                    disableSubmit = false;
                    return;
                }
            }

            // Advance options from $state
            migrator.createNewAccount = formData.createNewAccount;
            migrator.migrateRepo = formData.migrateRepo;
            migrator.migrateBlobs = formData.migrateBlobs;
            migrator.migrateMissingBlobs = formData.migrateMissingBlobs;
            migrator.migratePrefs = formData.migratePrefs;
            migrator.migratePlcRecord = formData.migratePlcRecord;


            updateStatusHandler('Starting migration...');
            showStatusMessage = true;

            await migrator.migrate(
                formData.handle,
                formData.password,
                formData.newPds,
                formData.newEmail,
                newHandle,
                formData.inviteCode,
                updateStatusHandler,
                formData.twoFactorCode,
                formData.verificationCode,
                formData.sourcePdsUrl || null,
            );
            if (migrator.migratePlcRecord) {
                //I don't think disable submit is needed, but you never know.
                disableSubmit = false;
                askForPlcToken = true;
            } else {
                updateStatusHandler('Migration of your repo is complete! But the PLC operation was not done so your old account is still the valid one.');
            }
        } catch (error) {
            disableSubmit = false;
            console.error(error);
            //@ts-expect-error: JS being js. doesn't like not having the type'
            if (error.error === 'AuthFactorTokenRequired') {
                showTwoFactorCodeInput = true;
                migrationInProgress = false;
            }
            //@ts-expect-error: JS being js. doesn't like not having the type'
            errorMessage = error.message;
        }
    }

</script>

<svelte:head>
    <title>PDS MOOver</title>
    <meta property="og:description" content="ATProto account migration tool"/>
    <OgImage/>
</svelte:head>

<div class="container">
    <MooHeader title="PDS MOOver"/>
    {#if !migrationInProgress}
        <a href={resolve('/info')}>Idk if I trust a cow to move my atproto account to a new PDS</a>
        <br/>
        <a href="https://blacksky.community/profile/did:plc:g7j6qok5us4hjqlwjxwrrkjm/post/3lw3hcuojck2u">Video guide for
            joining blacksky.app</a>
        {#if showCaptcha}
            <Captcha
                    pdsUrl={`https://${cleanSelectedPds}`}
                    handle={newHandle}
                    onSuccess={handleCaptchaSuccess}
                    onError={handleCaptchaError}
            />
        {:else}

            <form id="moover-form" onsubmit={submitMoove}>
                <!-- First section: Login credentials -->
                <div class="section">
                    <h2>Login for your current PDS</h2>
                    <div class="form-group">
                        <label for="handle">Old Handle:</label>
                        <input type="text" id="handle" name="handle" placeholder="alice.bsky.social" required
                               bind:value={formData.handle}>
                    </div>

                    <div class="form-group">
                        <label for="password">Old Password (Will also be your new password):</label>
                        <input type="password" id="password" name="password" required bind:value={formData.password}>
                    </div>
                    {#if showTwoFactorCodeInput}
                        <div class="form-group">
                            <label for="two-factor-code">2FA from the email sent</label>
                            <input type="text" id="two-factor-code" name="twoFactorCode"
                                   bind:value={formData.twoFactorCode}>
                            <div class="error-message">Enter your 2fa code here</div>

                        </div>
                    {/if}
                </div>

                <!-- Second section: New account details -->
                <div class="section">
                    <h2>
                        {#if selectedPds}
                            Setup for <span style="text-decoration: underline">{cleanSelectedPds}</span>
                        {:else}
                            Setup for the new PDS
                        {/if}
                        {#if !data.pdsOptions && selectedPds}
                            <button type="button" class="change-pds-btn"
                                    onclick={() => { pdsOverride = null; selectedDomain = null; formData.newPds = ''; }}>
                                Change
                            </button>
                        {/if}
                    </h2>
                    {#if !selectedPds}
                        <div class="form-group">
                            <label for="new-pds">New PDS (URL):</label>
                            <input type="url" id="new-pds" name="newPds" placeholder="https://coolnewpds.com"
                                   required bind:value={formData.newPds} list="allowed-pds-list">
                            <datalist id="allowed-pds-list">
                                {#each data.allowedPds as pds (pds)}
                                    <option value="{pds}"></option>
                                {/each}
                            </datalist>
                        </div>
                    {/if}

                    <div class="form-group">
                        <label for="new-email">New Email:</label>
                        <input type="email" id="new-email" name="newEmail"
                               placeholder="CanBeSameEmailAsTheOldPds@email.com"
                               required bind:value={formData.newEmail}>
                    </div>


                    <div class="form-group">
                        <label for="new-handle">New Handle:</label>
                        <div class={selectedPds ? 'input-group' : ''}>
                            <input type="text" id="new-handle" name="newHandle"
                                   placeholder="{handlePlaceHolder}"
                                   required
                                   bind:value={formData.newHandle}>
                            {#if selectedPds}

                                <select bind:value={selectedDomain} class="domain-select">
                                    {#each selectedPds?.availableUserDomains as domain (domain)}
                                        <option value={domain}>{domain}</option>
                                    {/each}
                                    <option value="custom">I have my own domain setup</option>

                                </select>
                            {/if}
                        </div>
                    </div>

                    {#if !selectedPds || selectedPds.inviteCodeRequired !== false}
                        <div class="form-group">
                            <label for="invite-code">Invite Code:</label>
                            <input type="text" id="invite-code" name="inviteCode"
                                   placeholder="Invite code from your new PDS (Leave blank if you don't have one)"
                                   bind:value={formData.inviteCode}>
                        </div>
                    {/if}
                </div>


                <div class="form-group">
                    <button type="button" onclick={() => showAdvance = !showAdvance} id="advance" name="advance">Advance
                        Options
                    </button>
                </div>
                {#if showAdvance}
                    <div class="section" style="padding-bottom: 10px; text-align: left">
                        <h3>Pick and choose which actions to run</h3>
                        <p>Useful if a migration failed and you want to have a bit more manual control</p>
                        <div class="form-control">
                            <label class="moove-checkbox-label">
                                <input type="checkbox" id="createNewAccount" name="createNewAccount"
                                       bind:checked={formData.createNewAccount}>
                                Create a New Account on the New PDS
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="moove-checkbox-label">
                                <input bind:checked={formData.migrateRepo} type="checkbox" id="migrateRepo"
                                       name="migrateRepo">
                                Migrate Repo
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="moove-checkbox-label">
                                <input bind:checked={formData.migrateBlobs} type="checkbox" id="migrateBlobs"
                                       name="migrateBlobs">
                                Migrate Blobs
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="moove-checkbox-label">
                                <input bind:checked={formData.migrateMissingBlobs} type="checkbox"
                                       id="migrateMissingBlobs"
                                       name="migrateMissingBlobs">
                                Migrate Missing Blobs
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="moove-checkbox-label">
                                <input bind:checked={formData.migratePrefs} type="checkbox" id="migratePrefs"
                                       name="migratePrefs">
                                Migrate Prefs
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="moove-checkbox-label">
                                <input bind:checked={formData.migratePlcRecord} type="checkbox" id="migratePlcRecord"
                                       name="migratePlcRecord">
                                Migrate PLC Record
                            </label>
                        </div>
                        <div class="form-group" style="margin-top: 10px;">
                            <label for="sourcePdsUrl">Developer option: Override the Source PDS URL</label>
                            <input type="url" id="sourcePdsUrl" name="sourcePdsUrl"
                                   placeholder="http://localhost:3000"
                                   bind:value={formData.sourcePdsUrl}>

                        </div>

                    </div>
                {/if}

                {#if requiresAccept}
                    <div class="section" style="text-align: left">
                        <h3>Provider policies</h3>
                        <p>
                            To migrate to {cleanSelectedPds}, you must review and accept:
                        </p>
                        <ul>
                            {#if privacyUrl}
                                <li><a href={privacyUrl} target="_blank" rel="noopener noreferrer">Privacy
                                    Policy</a></li>
                            {/if}
                            {#if tosUrl}
                                <li><a href={tosUrl} target="_blank" rel="noopener noreferrer">Terms of Service</a></li>
                            {/if}
                        </ul>
                        <div class="form-group">
                            <label for="accept-policies" class="moove-checkbox-label">
                                <input bind:checked={formData.acceptPolicies} type="checkbox" id="accept-policies"
                                       name="acceptPolicies" required>
                                <span>
                                I have read and accept

                            </span>
                            </label>
                        </div>
                    </div>
                {/if}
                <p style="text-align: left">There are some risks that come with doing an account migration.
                    (Can view them
                    <a href="https://github.com/bluesky-social/pds/blob/main/ACCOUNT_MIGRATION.md#%EF%B8%8F-warning-%EF%B8%8F-%EF%B8%8F">here</a>)
                    and that the creator or host of this migration tool is not liable and will not be able to help you
                    in
                    the
                    event something goes wrong. I also have read over the <a href={resolve('/info')}>extended
                        information
                        from
                        PDS MOOver
                        about account
                        migrations.</a>
                </p>
                <div class="form-group">
                    <label for="confirmation" class="moove-checkbox-label">
                        <input bind:checked={formData.confirmation} type="checkbox" id="confirmation"
                               name="confirmation"
                               required>
                        <span>I understand</span>
                    </label>
                </div>
                <div>
                    <button disabled={disableSubmit}
                            type="submit">{selectedPds ? `MOOve to ${cleanSelectedPds}` : 'MOOve'}</button>
                </div>

            </form>
        {/if}
    {:else}
        {#if !askForPlcToken}
            <div id="messageBoxes">
                <div class="warning">***Please make sure to stay on this page during the MOOve for the
                    best result.***
                </div>

                {#if errorMessage !== null}
                    <div class="error-message">{errorMessage}</div>

                    <div id="status-message" class="status-message">A error has occurred. Please take a screenshot of
                        this screen for support. You can also retry by refreshing the page and entering the same
                        information as before, it will not harm your account.
                    </div>

                {/if}

                {#if showStatusMessage}
                    <div id="status-message" class="status-message">{statusMessage}</div>
                {/if}
            </div>
        {/if}
    {/if}


    {#if askForPlcToken}
        <SignThePapers migrator={migrator} newHandle={newHandle} newPdsUrl={formData.newPds}/>
    {/if}


</div>

<style>
    .change-pds-btn {
        font-size: 0.7em;
        padding: 0.4em 0.12em;
        vertical-align: middle;
        font-weight: 400;
    }
</style>
