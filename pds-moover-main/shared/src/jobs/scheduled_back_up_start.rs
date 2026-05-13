use crate::jobs::account_backup::AccountBackupJobContext;
use crate::jobs::{account_backup, pds_backup, push_job_json};
use apalis::prelude::{Data, Error};
use jacquard::{client::BasicClient, identity::PublicResolver, prelude::IdentityResolver, url};
use jacquard_api::com_atproto::sync::get_repo_status::GetRepoStatus;
use jacquard_common::{types::did::Did, types::tid::Tid, xrpc::XrpcClient};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::sync::Arc;

pub const JOB_NAMESPACE: &str = "apalis::ScheduledBackUpStart";

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScheduledBackUpStartJobContext;

/// Finds the new PDS and saves it in the database if the user has changed PDSs since signing up
async fn find_new_pds_host(pool: &Pool<Postgres>, did: String) -> Option<String> {
    let resolver = PublicResolver::default();
    let did_string = did.clone();
    let did = match Did::new(did.as_str()) {
        Ok(did) => did,
        Err(err) => {
            log::error!("Failed to parse did {did} : {err}");
            return None;
        }
    };

    let did_doc = match resolver.resolve_did_doc_owned(&did).await {
        Ok(did_doc) => did_doc,
        Err(err) => {
            log::error!("Failed to resolve did doc for {did} : {err}");
            return None;
        }
    };

    match did_doc.pds_endpoint() {
        None => None,
        Some(url) => match url.host_str() {
            None => {
                log::error!("Failed to parse pds_endpoint for {did} : {url}");
                return None;
            }
            Some(host) => {
                //I may of copied and pasted this to get it going <.< who needs dry in all this snow
                let result = sqlx::query(
                    "UPDATE accounts SET pds_host = $2 WHERE did = $1 AND pds_host <> $2",
                )
                .bind(did_string)
                .bind(host)
                .execute(pool)
                .await;
                if let Err(e) = result {
                    log::error!("Failed to update pds_host for {did} : {e}");
                }
                // Ok(result.rows_affected())
                Some(host.to_string())
            }
        },
    }
}

/// This scheduled job finds:
/// - accounts that have not been backed up in the last 2 hours and have pds_sign_up = false,
///   and enqueues AccountBackup jobs for them;
/// - pds_hosts that are active and have not started a backup in the last 2 hours (tracked via
///   pds_hosts.last_backup_start), and enqueues PdsBackup jobs for each.
pub async fn scheduled_back_up_start_job(
    _job: ScheduledBackUpStartJobContext,
    pool: Data<Pool<Postgres>>,
) -> Result<(), Error> {
    log::info!("Starting a backup for the whole instance");
    // Record the start of a whole-network backup run
    sqlx::query(r#"INSERT INTO network_backup_runs DEFAULT VALUES"#)
        .execute(&*pool)
        .await
        .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;
    // 1) Query accounts needing backup
    // Condition: pds_sign_up = false AND (last_backup is NULL OR older than 6h)
    // We include did and pds_host to build AccountBackupJobContext
    let accounts: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT did, pds_host
        FROM accounts
        WHERE pds_sign_up = FALSE
          AND (last_backup IS NULL OR last_backup < NOW() - INTERVAL '2 HOURS')
        "#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

    //TODO maybe check here?
    let agent = BasicClient::unauthenticated();
    for (did, pds_host) in accounts {
        //This is a holder we can change the PDS if we need to
        let mut pds_host_to_call = pds_host.clone();

        //Need to do matches here cause I don't want to fail the whole loop
        let pds_url = match url::Url::parse(&format!("https://{}", pds_host)) {
            Ok(url) => url,
            Err(e) => {
                log::warn!("Failed to parse pds_host: {pds_host} \n {e}");
                continue;
            }
        };

        //Sets the agent to the new PDS URL
        agent.set_base_uri(pds_url).await;

        let request = GetRepoStatus {
            //May just leave this ?
            did: did.clone().parse().map_err(|_| {
                Error::Failed(Arc::new(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    "Failed to parse did",
                ))))
            })?,
        };

        let rev: Option<Tid> = match agent.send(request).await {
            Ok(response) => match response.parse() {
                Ok(output) => {
                    if output.active {
                        output.rev
                    } else {
                        match output.status {
                            None => {
                                log::warn!(
                                    "{did} has no status and not active. Not sure if this happens"
                                );
                                continue;
                            }
                            Some(status) => {
                                if status == "deactivated" {
                                    log::info!(
                                        "{did} has been deactivated on this PDS. Let's see if they moved."
                                    );
                                    match find_new_pds_host(&pool, did.clone()).await {
                                        None => continue,
                                        Some(new_host) => {
                                            log::info!(
                                                "{did} has moved to {new_host}. Database updated."
                                            );
                                            pds_host_to_call = new_host;
                                        }
                                    }
                                    //As long as it's successful, we can just send along None for the sub job to pick up the new rev on the new PDS
                                    None
                                } else {
                                    //TODO will most likely set accounts to deactivated as i collect more data here
                                    log::warn!("{did} has the repo status {status}.");
                                    continue;
                                }
                            }
                        }
                    }
                }
                Err(err) => {
                    log::warn!("Failed to parse GetRepoStatusResponse for: {did} \n {err}");
                    continue;
                }
            },
            Err(err) => {
                log::warn!("Failed to send GetRepoStatusRequest for: {did} \n {err}");
                continue;
            }
        };

        let rev_string: Option<String> = rev.map(|r| r.to_string());

        let ctx = AccountBackupJobContext {
            did,
            pds_host: pds_host_to_call,
            rev: rev_string,
        };

        push_job_json(&pool, account_backup::JOB_NAMESPACE, &ctx).await?;
    }

    // 3) Query pds_hosts needing backup start
    // Condition: active = TRUE AND (last_backup_start is NULL OR older than 24h)
    let pds_hosts: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT pds_host
        FROM pds_hosts
        WHERE active = TRUE
          AND (last_backup_start IS NULL OR last_backup_start < NOW() - INTERVAL '2 HOURS')
        "#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

    // To avoid racing / double-enqueue, mark last_backup_start immediately for those we are about to enqueue
    if !pds_hosts.is_empty() {
        sqlx::query(
            r#"
            UPDATE pds_hosts
            SET last_backup_start = NOW()
            WHERE pds_host = ANY($1)
            "#,
        )
        .bind(&pds_hosts)
        .execute(&*pool)
        .await
        .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;
    }

    for host in pds_hosts {
        let ctx = crate::jobs::pds_backup::PdsBackupJobContext { pds_host: host };
        push_job_json(&pool, pds_backup::JOB_NAMESPACE, &ctx).await?;
    }

    Ok(())
}
