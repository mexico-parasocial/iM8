use crate::jobs::account_backup::AccountBackupJobContext;
use crate::jobs::{account_backup, push_job_json};
use apalis::prelude::{Data, Error};
use jacquard_common::url::Url;
use jacquard_common::xrpc::XrpcEndpoint;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::sync::Arc;

pub const JOB_NAMESPACE: &str = "apalis::PdsBackup";

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PdsBackupJobContext {
    pub pds_host: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ListReposResponseRepo {
    pub did: String,
    pub active: bool,
    pub rev: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ListReposResponse {
    pub repos: Vec<ListReposResponseRepo>,
    pub cursor: Option<String>,
}

/// Call com.atproto.sync.listRepos on the given PDS host, upsert active repos into accounts,
/// and enqueue account_backup jobs for each active repo.
pub async fn pds_backup_job(
    job: PdsBackupJobContext,
    pool: Data<Pool<Postgres>>,
    atproto_client: Data<Arc<reqwest::Client>>,
) -> Result<(), Error> {
    let pds_host = format!("https://{}", job.pds_host.clone());
    log::info!("Starting a backup for the PDS: {}", pds_host);

    // Mark the start time for this PDS backup to prevent duplicate scheduling and to record start time
    sqlx::query(
        r#"
        UPDATE pds_hosts
        SET last_backup_start = NOW()
        WHERE pds_host = $1
        "#,
    )
    .bind(&job.pds_host)
    .execute(&*pool)
    .await
    .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

    //Always expecting the host to be just the host name
    let base_url =
        Url::parse(&pds_host.clone()).map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

    let mut cursor: Option<String> = None;
    loop {
        let mut url = format!(
            "{}{}?limit={}",
            base_url.as_str().trim_end_matches('/'),
            jacquard_api::com_atproto::sync::list_repos::ListReposRequest::PATH,
            1000
        );
        if let Some(ref c) = cursor {
            if !c.is_empty() {
                url.push_str("&cursor=");
                url.push_str(c);
            }
        }

        let resp = atproto_client
            .get(url)
            .send()
            .await
            .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?
            .json::<ListReposResponse>()
            .await
            .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

        // Filter active repos
        let active_repos: Vec<(String, String)> = resp
            .repos
            .into_iter()
            .filter(|r| r.active)
            .map(|r| (r.did, r.rev))
            .collect();

        if !active_repos.is_empty() {
            // Batch upsert accounts using UNNEST; preserve created_at and pds_sign_up on conflict.
            //TODO may filter ones not signed up on the PDS? Be a new SQL query to get those turned on via the PDS?
            let dids_with_revs: Vec<(String, String)> = active_repos
                .iter()
                .map(|(d, rev)| (d.clone(), rev.clone()))
                .collect();
            let dids: Vec<String> = active_repos.iter().map(|(d, _)| d.clone()).collect();

            // Insert and set pds_sign_up=true only for new rows. Do nothing on conflict.
            // We unnest only DIDs; pds_host is a single scalar projected for each row.
            sqlx::query(
                r#"
                INSERT INTO accounts (did, pds_host, pds_sign_up)
                SELECT did, $2::text AS pds_host, TRUE
                FROM UNNEST($1::text[]) AS u(did)
                ON CONFLICT (did) DO NOTHING
                "#,
            )
            .bind(&dids)
            .bind(&job.pds_host)
            .execute(&*pool)
            .await
            .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

            // Enqueue account_backup jobs for each active repo in this page
            for (did, rev) in dids_with_revs.into_iter() {
                let ctx = AccountBackupJobContext {
                    did,
                    pds_host: job.pds_host.clone(),
                    rev: Some(rev),
                };
                push_job_json(&pool, account_backup::JOB_NAMESPACE, &ctx).await?;
            }
        }
        cursor = resp.cursor;
        if cursor.as_deref().map(|s| s.is_empty()).unwrap_or(true) {
            break;
        }
    }

    Ok(())
}
