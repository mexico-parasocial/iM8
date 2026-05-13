<script lang="ts">
    import type {BackupService} from '@pds-moover/moover';
    import type {InferXRPCBodyOutput} from '@atcute/lexicons';
    import {ComPdsmooverBackupGetRepoStatus} from '@pds-moover/lexicons';
    import {formatDate, formatBytes} from '$lib/utils/displayUtils';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';


    let {
        backupService,
        repoStatus = $bindable()
    }: {
        backupService: BackupService;
        repoStatus: InferXRPCBodyOutput<ComPdsmooverBackupGetRepoStatus.mainSchema['output']> | null;
    } = $props();

    // State variables
    let errorMessage = $state<string | null>(null);
    let showStatusMessage = $state(false);
    let statusMessageText = $state('');
    let isRefreshing = $state(false);
    let isRunningBackup = $state(false);
    let isDeleting = $state(false);

    function updateStatusHandler(status: string) {
        console.log('Status update:', status);
        statusMessageText = status;
    }

    async function handleRunBackupNow() {
        errorMessage = null;
        isRunningBackup = true;
        showStatusMessage = true;
        try {
            await backupService.runBackupNow(updateStatusHandler);
            repoStatus = await backupService.getUsersRepoStatus(updateStatusHandler);
            updateStatusHandler('Backup request sent. Status refreshed.');
            showStatusMessage = false;
        } catch (e) {
            console.error(e);
            //@ts-expect-error: Error is handled
            errorMessage = e.message || 'Failed to request backup.';
        } finally {
            isRunningBackup = false;
        }
    }

    async function handleRemoveRepo() {
        if (
            confirm(
                'Deleting your backups removes all your data and unregisters you for automatic backups. Your rotation key created here will stay valid, but you will not be able to restore your data from PDS MOOver.'
            )
        ) {
            isDeleting = true;
            try {
                await backupService.removeRepo(updateStatusHandler);
                repoStatus = await backupService.getUsersRepoStatus(updateStatusHandler);
            } catch (e) {
                console.error(e);
                //@ts-expect-error: Error is handled
                errorMessage = e.message || 'Failed to delete backup repository';
            } finally {
                isDeleting = false;
            }
        }
    }

    async function refreshStatus() {
        isRefreshing = true;
        try {
            repoStatus = await backupService.getUsersRepoStatus(updateStatusHandler);
        } catch (e) {
            console.error(e);
            //@ts-expect-error: Error is handled
            errorMessage = e.message || 'Failed to refresh status';
        } finally {
            showStatusMessage = false;
            isRefreshing = false;
        }
    }
</script>

<div class="section">
    <div class="section-header">
        <h2 style="margin: 0;">Backup repository status</h2>
        <button
                type="button"
                class="icon-button"
                title="Refresh status"
                aria-label="Refresh status"
                onclick={refreshStatus}
                disabled={isRefreshing}
                style={isRefreshing ? 'opacity: 0.6;' : ''}
        >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
                 style={isRefreshing ? 'animation: spin 1s linear infinite;' : ''}>
                <path
                        d="M17.65 6.35A7.95 7.95 0 0012 4a8 8 0 108 8h-2a6 6 0 11-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                ></path>
            </svg>
        </button>
    </div>
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">DID</div>
            <div class="stat-value stat-value--small">{repoStatus?.did || '—'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Created</div>
            <div class="stat-value stat-value--small">{formatDate(repoStatus?.createdAt)}</div>
        </div>
        {#if repoStatus?.lastBackup != null}
            <div class="stat-card">
                <div class="stat-label">Last backup</div>
                <div class="stat-value stat-value--small">{formatDate(repoStatus.lastBackup)}</div>
            </div>
        {/if}
        {#if repoStatus?.rev != null}
            <div class="stat-card">
                <div class="stat-label">Current rev</div>
                <div class="stat-value stat-value--small">{repoStatus.rev}</div>
            </div>
        {/if}
        {#if repoStatus?.blobCount != null}
            <div class="stat-card">
                <div class="stat-label">Total blobs</div>
                <div class="stat-value">{repoStatus.blobCount.toLocaleString()}</div>
            </div>
        {/if}
        {#if repoStatus?.estimatedBackupSize != null}
            <div class="stat-card">
                <div class="stat-label">Estimated size</div>
                <div class="stat-value">{formatBytes(repoStatus.estimatedBackupSize)}</div>
            </div>
        {/if}
        {#if repoStatus?.missingBlobCount != null}
            <div class="stat-card">
                <div class="stat-label">Missing blobs</div>
                <div class="stat-value">{repoStatus.missingBlobCount.toLocaleString()}</div>
            </div>
        {/if}
        {#if repoStatus?.source != null}
            <div class="stat-card">
                <div class="stat-label">Source</div>
                <div class="stat-value stat-value--small">{repoStatus.source}</div>
            </div>
        {/if}
    </div>
    <div class="actions" style="padding-top: 5%">
        <button type="button" onclick={handleRunBackupNow} disabled={isRunningBackup}>
            {#if isRunningBackup}
                <LoadingSpinner/>
            {/if}
            Manually run backup now
        </button>
        <button type="button" style="background-color: #c62828; color: #fff;" onclick={handleRemoveRepo}
                disabled={isDeleting}>
            {#if isDeleting}
                <LoadingSpinner/>
            {/if}
            Delete Backups
        </button>
    </div>
    {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
    {/if}
    {#if showStatusMessage}
        <div class="status-message">{statusMessageText}</div>
    {/if}
</div>

<style>
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
