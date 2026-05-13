use crate::db::models::{BlobModel, BlobType};
use crate::storage::{blob_backup_path, repo_backup_path};
use anyhow::Result;
use s3::Bucket;
use sqlx::{Pool, Postgres};

/// Verifies that all blobs in the database exist in S3.
/// Returns a Vec of missing blob information (did, cid_or_rev, blob_type).
pub async fn verify_backups(pool: &Pool<Postgres>, s3_bucket: &Bucket) -> Result<Vec<MissingBlob>> {
    // Get all blobs from the database
    let blobs = sqlx::query_as::<_, BlobModel>("SELECT * FROM blobs ORDER BY created_at")
        .fetch_all(pool)
        .await?;

    let total_blobs = blobs.len();
    log::info!("Checking {} blobs in S3...", total_blobs);

    let mut missing_blobs = Vec::new();
    let mut checked = 0;

    for blob in blobs {
        checked += 1;
        if checked % 100 == 0 {
            log::info!("Checked {}/{} blobs...", checked, total_blobs);
        }

        let s3_path = match blob.r#type {
            BlobType::Repo => repo_backup_path(blob.account_did.clone()),
            BlobType::Blob => blob_backup_path(blob.account_did.clone(), blob.cid_or_rev.clone()),
            BlobType::Prefs => {
                // Handle prefs if needed - for now skip
                log::debug!("Skipping prefs blob: {:?}", blob);
                continue;
            }
        };

        // Check if the object exists in S3
        match s3_bucket.head_object(&s3_path).await {
            Ok(_) => {
                // Object exists, all good
                log::debug!("✓ Found: {}", s3_path);
            }
            Err(e) => {
                // Check if it's a 404 error (not found)
                if e.to_string().contains("404") {
                    log::warn!("✗ Missing: {}", s3_path);
                    missing_blobs.push(MissingBlob {
                        did: blob.account_did.clone(),
                        cid_or_rev: blob.cid_or_rev.clone(),
                        blob_type: blob.r#type.clone(),
                        s3_path,
                    });
                } else {
                    // Some other error - log it but don't count as missing
                    log::error!("Error checking {}: {}", s3_path, e);
                }
            }
        }
    }

    log::info!(
        "Verification complete. Checked {} blobs, found {} missing.",
        checked,
        missing_blobs.len()
    );

    Ok(missing_blobs)
}

#[derive(Debug, Clone)]
pub struct MissingBlob {
    pub did: String,
    pub cid_or_rev: String,
    pub blob_type: BlobType,
    pub s3_path: String,
}
