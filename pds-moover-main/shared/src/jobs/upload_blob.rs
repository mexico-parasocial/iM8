use crate::db::models;
use crate::jobs::account_backup::AccountBackupJobContext;
use crate::jobs::{
    AnyhowErrorWrapper, get_repo_rev_by_did, record_new_blob, update_last_backup_now_by_did,
    update_repo_rev_by_did,
};
use crate::storage::{blob_backup_path, repo_backup_path};
use apalis::prelude::{Data, Error};
use async_compression::futures::bufread::ZstdEncoder;
use futures::TryStreamExt;
use reqwest::Client;
use reqwest::header::{ACCEPT, CONTENT_TYPE};
use s3::Bucket;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio_util::compat::FuturesAsyncReadCompatExt;

pub const JOB_NAMESPACE: &str = "apalis::UploadBlob";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct XrpcError {
    error: String,
    message: Option<String>,
}

impl std::fmt::Display for XrpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.message {
            Some(msg) => write!(f, "{}: {}", self.error, msg),
            None => write!(f, "{}", self.error),
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub enum BlobType {
    ///The string here is the rev. If it's from the pds backup start it already has the rev saving a web call
    Repo(Option<String>),
    //The vec is the cids of the blobs to pull
    Blob(Vec<String>),
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct AtProtoRepoStatusResponse {
    pub rev: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UploadBlobJobContext {
    pub account_backup_job_context: AccountBackupJobContext,
    pub blob_type: BlobType,
    /// If set to true, this is the last batch of blobs to upload for this account and can mark the job as complete.
    pub last_upload_batch: bool,
}

pub async fn upload_blob_job(
    job: UploadBlobJobContext,
    pool: Data<Pool<Postgres>>,
    atproto_client: Data<Arc<reqwest::Client>>,
    s3_client: Data<Arc<Box<Bucket>>>,
) -> Result<(), Error> {
    let did = job.account_backup_job_context.did.clone();
    let pds_host = job.account_backup_job_context.pds_host.clone();

    match job.blob_type {
        BlobType::Repo(rev) => {
            let current_rev = match rev {
                None => {
                    //todo Prob just always pass in a rev? induivial uplaods do this anyhow
                    let url = format!(
                        "https://{}/xrpc/com.atproto.sync.getRepoStatus?did={}",
                        pds_host, did,
                    );

                    let resp = atproto_client
                        .get(url)
                        .send()
                        .await
                        .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?
                        .json::<AtProtoRepoStatusResponse>()
                        .await
                        .map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;
                    resp.rev.clone()
                }
                Some(rev) => rev,
            };

            //TODO this is fialing on reruns since it's not being updated
            let current_backed_up_rev =
                get_repo_rev_by_did(&pool, &job.account_backup_job_context.did)
                    .await
                    .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(e)))))?
                    //I'm cool with this unwrap since it should fail the if check
                    .unwrap_or("".to_string());
            if current_backed_up_rev == current_rev {
                log::info!("Repo is already backed up at the rev: {}", current_rev);
                update_last_backup_now_by_did(&pool, did.as_str())
                    .await
                    .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(e)))))?;
                return Ok(());
            }

            let repo_url = format!(
                "https://{}/xrpc/com.atproto.sync.getRepo?did={}",
                pds_host, did
            );

            match download_compress_and_upload_blob(
                repo_backup_path(did.clone()),
                &atproto_client,
                &s3_client,
                repo_url,
                models::BlobType::Repo,
            )
            .await
            {
                Ok(size) => {
                    record_new_blob(
                        &pool,
                        did.clone(),
                        current_rev.clone(),
                        //TODO bad
                        size.try_into().unwrap(),
                        models::BlobType::Repo,
                    )
                    .await
                    .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(e)))))?;

                    update_repo_rev_by_did(&pool, &did, &current_rev)
                        .await
                        .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(e)))))?;
                }
                Err(e) => {
                    return match e {
                        DownloadCompressAndUploadError::AnyError(e) => Err(e),
                        DownloadCompressAndUploadError::BlobDownloadError => {
                            Err(Error::Failed(Arc::new(
                                anyhow::anyhow!("Error downloading the repo for: {did}").into(),
                            )))
                        }
                        DownloadCompressAndUploadError::BlobNotFound => {
                            log::warn!("Repo not found, skipping backup");
                            Err(Error::Failed(Arc::new(Box::new(std::io::Error::new(
                                std::io::ErrorKind::NotFound,
                                "Repo not found",
                            )))))
                        }
                    };
                }
            };
        }

        BlobType::Blob(cids) => {
            // log::info!("Uploading {:?} blobs for {}", cids.len(), did);
            for cid in cids {
                let blob_url = format!(
                    "https://{}/xrpc/com.atproto.sync.getBlob?did={}&cid={}",
                    pds_host, did, cid
                );

                match download_compress_and_upload_blob(
                    blob_backup_path(did.clone(), cid.clone()),
                    &atproto_client,
                    &s3_client,
                    blob_url,
                    models::BlobType::Blob,
                )
                .await
                {
                    Ok(blob_size) => {
                        record_new_blob(
                            &pool,
                            did.clone(),
                            cid,
                            blob_size.try_into().unwrap(),
                            models::BlobType::Blob,
                        )
                        .await
                        .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(e)))))?;
                    }
                    Err(err) => match err {
                        DownloadCompressAndUploadError::AnyError(err) => {
                            return Err(err);
                        }
                        DownloadCompressAndUploadError::BlobNotFound => {
                            // Record missing blob so it can be retried or inspected later. On conflict, do nothing.
                            if let Err(e) = sqlx::query(
                                "INSERT INTO missing_blobs (did, cid, created_date) VALUES ($1, $2, now()) ON CONFLICT DO NOTHING",
                            )
                            .bind(&did)
                            .bind(&cid)
                            .execute(&*pool)
                            .await
                            {
                                log::warn!("Failed to record missing blob {cid} for {did}: {e}");
                            }
                            log::warn!("Blob: {cid} not found for: {did}");
                        }
                        DownloadCompressAndUploadError::BlobDownloadError => {
                            //Silently ignoring atm not to mess with the chunk
                        }
                    },
                }
            }

            if job.last_upload_batch {
                log::info!("backup completed for {}", did);
                update_last_backup_now_by_did(&pool, did.as_str())
                    .await
                    .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(e)))))?;
            }
        }
    }

    Ok(())
}

pub enum DownloadCompressAndUploadError {
    AnyError(Error),
    BlobNotFound,
    BlobDownloadError,
}

async fn download_compress_and_upload_blob(
    object_key: String,
    atproto_client: &Data<Arc<Client>>,
    s3_client: &Data<Arc<Box<Bucket>>>,
    repo_url: String,
    blob_type: models::BlobType,
) -> Result<usize, DownloadCompressAndUploadError> {
    let accept_type = match blob_type {
        models::BlobType::Repo => "application/vnd.ipld.car",
        _ => "*/*",
    };

    let response = atproto_client
        .get(repo_url.clone())
        .header(ACCEPT, accept_type)
        .send()
        .await
        .map_err(|e| {
            DownloadCompressAndUploadError::AnyError(Error::Failed(Arc::new(Box::new(e))))
        })?;
    let response_status = response.status();

    if !response_status.is_success() {
        let error_body = response.json::<XrpcError>().await.map_err(|e| {
            DownloadCompressAndUploadError::AnyError(Error::Failed(Arc::new(Box::new(e))))
        })?;
        if error_body.error == "InvalidRequest" {
            if let Some(message) = error_body.message.as_deref() {
                if message == "Blob not found" {
                    return Err(DownloadCompressAndUploadError::BlobNotFound);
                }
            }
        }
        // response.error_for_status().map_err(|e| {
        //     DownloadCompressAndUploadError::AnyError(Error::Failed(Arc::new(Box::new(e))))
        // })?;
        return Err(DownloadCompressAndUploadError::AnyError(Error::Failed(
            Arc::new(
                anyhow::anyhow!("Error downloading the blob: {response_status} {repo_url}").into(),
            ),
        )));
    }

    // Derive content type from the blob response headers; default to octet-stream
    // Should also get the car type
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let blob_reader = response
        .bytes_stream()
        .map_err(|e| futures::io::Error::new(futures::io::ErrorKind::Other, e))
        .into_async_read();

    let zstd_encoder = ZstdEncoder::new(blob_reader);
    let mut zstd_tokio_reader = zstd_encoder.compat();

    match s3_client
        .put_object_stream_builder(object_key.as_str())
        .with_content_type(content_type)
        .with_content_encoding("zstd")
        .map_err(|e| {
            DownloadCompressAndUploadError::AnyError(Error::Failed(Arc::new(Box::new(e))))
        })?
        .execute_stream(&mut zstd_tokio_reader)
        .await
    {
        Ok(result) => {
            log::debug!("Uploaded: {}", object_key);
            Ok(result.uploaded_bytes().try_into().unwrap())
        }
        Err(err) => {
            log::warn!("Failed to upload: {}: {}, trying again.", object_key, err);
            //Try again but with a more basic content type. Usually happens when a user has an odd blob that is not supported by the s3. Like an html page
            let put_result = s3_client
                .put_object_stream_builder(&object_key)
                .with_content_type("application/octet-stream")
                .with_content_encoding("zstd")
                .map_err(|e| {
                    DownloadCompressAndUploadError::AnyError(Error::Failed(Arc::new(Box::new(e))))
                })?
                .execute_stream(&mut zstd_tokio_reader)
                .await;
            match put_result {
                Ok(result) => {
                    log::debug!("Uploaded: {}", object_key);
                    Ok(result.uploaded_bytes().try_into().unwrap())
                }
                Err(err) => Err(DownloadCompressAndUploadError::AnyError(Error::Failed(
                    Arc::new(Box::new(err)),
                ))),
            }
        }
    }
}
