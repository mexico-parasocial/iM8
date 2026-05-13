use crate::jobs::upload_blob::{BlobType, UploadBlobJobContext};
use crate::jobs::{AnyhowErrorWrapper, filter_missing_blob_cids, push_job_json, upload_blob};
use apalis::prelude::{Data, Error};
use jacquard_api::com_atproto::sync::list_blobs::ListBlobsRequest;
use jacquard_common::xrpc::XrpcEndpoint;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::sync::Arc;

pub const JOB_NAMESPACE: &str = "apalis::AccountBackup";

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AccountBackupJobContext {
    pub did: String,
    // If the job start comes from the PDS backup this is already set saving a request to the PDS
    pub rev: Option<String>,
    pub pds_host: String,
}

#[derive(Deserialize)]
struct ListBlobsResponse {
    #[allow(dead_code)]
    cursor: Option<String>,
    cids: Vec<String>,
}

pub async fn account_backup_job(
    job: AccountBackupJobContext,
    pool: Data<Pool<Postgres>>,
    atproto_client: Data<Arc<reqwest::Client>>,
) -> Result<(), Error> {
    log::info!("Starting backup for did: {}", job.did);

    push_job_json(
        &pool,
        upload_blob::JOB_NAMESPACE,
        &UploadBlobJobContext {
            account_backup_job_context: job.clone(),
            blob_type: BlobType::Repo(job.rev.clone()),
            last_upload_batch: false,
        },
    )
    .await?;

    let mut cursor: Option<String> = None;
    loop {
        let mut url = format!(
            "https://{}{}?did={}&limit={}",
            job.pds_host,
            ListBlobsRequest::PATH,
            job.did,
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
            .json::<ListBlobsResponse>()
            .await
            .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

        let missing_cids = filter_missing_blob_cids(&pool, &resp.cids, &job.did)
            .await
            .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(e)))))?;

        // Process missing CIDs in batches of 5
        let mut processed = 0;

        for chunk in missing_cids.chunks(5) {
            processed += chunk.len();
            let last_chunk = processed >= missing_cids.len();
            push_job_json(
                &pool,
                upload_blob::JOB_NAMESPACE,
                &UploadBlobJobContext {
                    account_backup_job_context: job.clone(),
                    blob_type: BlobType::Blob(chunk.to_vec()),
                    last_upload_batch: last_chunk,
                },
            )
            .await?;
        }

        cursor = resp.cursor;
        if cursor.is_none() || cursor.as_ref().unwrap().is_empty() {
            break;
        }
    }
    Ok(())
}
