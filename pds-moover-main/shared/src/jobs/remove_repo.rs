use crate::db::Db;
use crate::jobs::AnyhowErrorWrapper;
use crate::storage::backup_base;
use anyhow::{Result, anyhow};
use apalis::prelude::*;
use s3::Bucket;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

use std::sync::Arc;
pub const JOB_NAMESPACE: &str = "apalis::RemoveRepo";

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RemoveRepoJobContext {
    pub did: String,
}

/// Execute the remove-repo operation: delete all S3 objects under users/{did}/ and
/// remove DB rows (blobs, missing_blobs, account) for the DID.
pub async fn run(
    ctx: RemoveRepoJobContext,
    pool: Data<Pool<Postgres>>,
    s3_bucket: Data<Arc<Box<Bucket>>>,
) -> Result<(), Error> {
    let did = ctx.did;
    log::info!("Removing repo for DID {}", did);
    let db = Db::new(&*pool);
    // 1) Delete all S3 objects for this DID under users/{did}/
    let prefix = format!("{}/", backup_base(did.clone()));
    let list_results = s3_bucket
        .list(prefix.clone(), None)
        .await
        .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(anyhow!(e))))))?;
    for page in list_results {
        for obj in page.contents {
            // Best-effort deletion; fail-fast on error to avoid DB partial delete
            s3_bucket
                .delete_object(&obj.key)
                .await
                //I hate it too
                .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(anyhow!(e))))))?;
        }
    }

    // 2) Delete DB rows: blobs, missing_blobs, then account
    let _ = db
        .delete_blobs_by_did(&did)
        .await
        .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(anyhow!(e))))))?;

    // Best-effort missing_blobs cleanup
    let _ = db.delete_missing_blobs_by_did(&did).await.ok();
    let _ = db
        .delete_account_by_did(&did)
        .await
        .map_err(|e| Error::Failed(Arc::new(Box::new(AnyhowErrorWrapper(anyhow!(e))))))?;
    log::info!("All data for the repo {} has been deleted", did);
    Ok(())
}
