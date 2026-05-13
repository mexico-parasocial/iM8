<script lang="ts">
    import MooHeader from '$lib/components/MooHeader.svelte';
    import type {PageProps} from '../../.svelte-kit/types/src/routes/$types';
    import {formatDate, formatBytes} from '$lib/utils/displayUtils';
    import {resolve} from '$app/paths';
    import OgImage from '$lib/components/OgImage.svelte';

    let {data}: PageProps = $props();
    let repoSize = $derived(formatBytes(data.estimatedReposSizeOnDisk));
    let blobSize = $derived(formatBytes(data.estimatedBlobsSizeOnDisk));
    let lastBackedUp = $derived(formatDate(data.lastBackupAt))
    let lastStatusUpdate = $derived(formatDate(data.statusLastUpdated))

</script>

<svelte:head>
    <title>PDS MOOver</title>
    <meta property="og:description" content="PDS MOOver – ATProto tools for PDS migrations and backups"/>
    <OgImage/>
</svelte:head>

<div class="container">

    <MooHeader title="PDS MOOver"/>
    <section class="section" style="text-align:left">
        <p>
            PDS MOOver is a set of AT Protocol tools to help you
            <a href={resolve('/moover')}>migrate to a new PDS</a>,
            <a href="/missing-blobs">find your missing blobs</a>,
            sign up for free automated <a href="/backups">backups</a>, and <a href="/restore">restore your account</a>
            in the event you need to.
        </p>
        <ul>
            <li><a href={resolve('/moover')}>Moover</a> – helps you migrate to a new PDS.</li>
            <li><a href="/missing-blobs">Missing Blobs</a> – find any missing blobs (pictures/videos) from a previous
                migration.
            </li>
            <li><a href="/backups">Backups</a> – sign up for free automated backups stored on PDS MOOver servers and
                view your account's backup status.
            </li>
            <li><a href="/restore">Restore</a> – restore from your backups if needed.</li>
            <li><a href="/turn-off">Turn Off</a> – helper to make sure your old account is deactivated.</li>
            <li><a href={resolve('/info')}>Info</a> – FAQs and a few other bits of information about our tools.</li>
            <li><a href="https://tangled.org/@baileytownsend.dev/pds-moover">Check our source code on tangled</a></li>
        </ul>
    </section>

    <section class="section" aria-labelledby="stats-heading">
        <h2 id="stats-heading">Server stats</h2>
        <span>Total stats for all accounts backed up on pdsmoover.com</span>
        <div style="padding-top: 5%" class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total repositories</div>
                <div class="stat-value">{data.totalRepos.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total blobs</div>
                <div class="stat-value">{data.totalBlobs.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Estimated total repo size</div>
                <div class="stat-value">{repoSize}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Estimated total blob size</div>
                <div class="stat-value">{blobSize}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last backup ran at</div>
                <div class="stat-value stat-value--small">{lastBackedUp}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Server Status last updated</div>
                <div class="stat-value stat-value--small">{lastStatusUpdate}</div>
            </div>
        </div>
        <!--        <div class="warning-message" x-show="error" x-text="error"></div>-->
    </section>
</div>