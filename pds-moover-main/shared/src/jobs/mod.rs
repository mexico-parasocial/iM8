pub mod account_backup;
pub mod pds_backup;
pub mod remove_repo;
pub mod scheduled_back_up_start;
pub mod start_all_backup;
pub mod upload_blob;
pub mod verify_backups;

use crate::db::models;
use crate::db::models::BlobModel;
use apalis::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{self};
use sqlx::{Pool, Postgres, query};
use std::collections::HashSet;
use std::fmt;
use std::sync::Arc;

#[derive(Debug)]
pub enum JobError {
    SomeError(&'static str),
}

impl std::fmt::Display for JobError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}

// Create a wrapper struct that implements std::error::Error
#[derive(Debug)]
struct AnyhowErrorWrapper(anyhow::Error);

impl fmt::Display for AnyhowErrorWrapper {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for AnyhowErrorWrapper {}

/// Generic helper to manually enqueue any Apalis job by calling the SQL function directly.
///
/// - job_namespace: fully-qualified job type name as stored by Apalis (e.g., "apalis::Email").
/// - payload: any struct that implements Serialize + Deserialize; it will be sent as JSON.
pub async fn push_job_json<T>(
    pool: &Pool<Postgres>,
    job_namespace: &str,
    payload: &T,
) -> Result<(), Error>
where
    T: Serialize + for<'de> Deserialize<'de>,
{
    // Serialize payload to JSON and send to Postgres as json
    let json_str =
        serde_json::to_string(payload).map_err(|e| Error::Failed(Arc::new(Box::new(e))))?;

    query("select apalis.push_job($1, $2::json)")
        .bind(job_namespace)
        .bind(json_str)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|e| Error::Failed(Arc::new(Box::new(e))))
}

/// Given a list of CIDs, returns those that are NOT already present in the blobs table
/// with blob type = 'blob' and matches the user's did in the case of duplicate blobs for each user
pub async fn filter_missing_blob_cids(
    pool: &Pool<Postgres>,
    cids: &Vec<String>,
    users_did: &String,
) -> anyhow::Result<Vec<String>> {
    if cids.is_empty() {
        return Ok(Vec::new());
    }

    // Fetch the subset of provided CIDs that already exist as type 'blob'
    let existing: Vec<String> = sqlx::query_scalar(
        r#"SELECT cid_or_rev FROM blobs WHERE type = $1 AND cid_or_rev = ANY($2) AND account_did = $3"#,
    )
    .bind(crate::db::models::BlobType::Blob)
    .bind(&cids)
    .bind(users_did)
    .fetch_all(pool)
    .await?;

    let existing_set: HashSet<&str> = existing.iter().map(|s| s.as_str()).collect();
    let missing: Vec<String> = cids
        .iter()
        .filter(|cid| !existing_set.contains(cid.as_str()))
        .cloned()
        .collect();

    Ok(missing)
}

pub async fn record_new_blob(
    pool: &Pool<Postgres>,
    did: String,
    cid_or_rev: String,
    size: i64,
    blob_type: models::BlobType,
) -> anyhow::Result<models::BlobModel> {
    match blob_type {
        //On repo we need to upsert on did
        models::BlobType::Repo => {
            // First try to update an existing 'repo' blob row for this DID.
            if let Some(updated) = sqlx::query_as::<_, BlobModel>(
                r#"
                    UPDATE blobs
                    SET size = $2,
                        type = $3,
                        cid_or_rev = $4
                    WHERE account_did = $1 AND type = $3
                    RETURNING id, created_at, account_did, size, type, cid_or_rev
                "#,
            )
            .bind(&did)
            .bind(size)
            .bind(&blob_type)
            .bind(&cid_or_rev)
            .fetch_optional(pool)
            .await?
            {
                Ok(updated)
            } else {
                // If no row was updated, insert a new one for this DID and repo type.
                Ok(sqlx::query_as::<_, BlobModel>(
                    r#"
                        INSERT INTO blobs (account_did, size, type, cid_or_rev)
                        VALUES ($1, $2, $3, $4)
                        RETURNING id, created_at, account_did, size, type, cid_or_rev
                    "#,
                )
                .bind(did)
                .bind(size)
                .bind(blob_type)
                .bind(cid_or_rev)
                .fetch_one(pool)
                .await?)
            }
        }
        //on blob we upsert on (account_did, cid_or_rev)
        models::BlobType::Blob | _ => Ok(sqlx::query_as::<_, BlobModel>(
            r#"
                    INSERT INTO blobs (account_did, size, type, cid_or_rev)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (account_did, cid_or_rev) DO UPDATE
                        SET size = EXCLUDED.size,
                            type = EXCLUDED.type
                    RETURNING id, created_at, account_did, size, type, cid_or_rev
                "#,
        )
        .bind(did)
        .bind(size)
        .bind(blob_type)
        .bind(cid_or_rev)
        .fetch_one(pool)
        .await?),
    }
}

/// Look up the user's account by DID and return their repo_rev, if present.
pub async fn get_repo_rev_by_did(
    pool: &Pool<Postgres>,
    did: &str,
) -> anyhow::Result<Option<String>> {
    // repo_rev is nullable; also the account row may not exist.
    // Using fetch_optional yields Option<Option<String>> which we flatten to a single Option<String>.
    let result: Option<Option<String>> =
        sqlx::query_scalar(r#"SELECT repo_rev FROM accounts WHERE did = $1"#)
            .bind(did)
            .fetch_optional(pool)
            .await?;

    Ok(result.flatten())
}

/// Update the repo_rev for a given account identified by DID.
/// Returns true if a row was updated.
pub async fn update_repo_rev_by_did(
    pool: &Pool<Postgres>,
    did: &str,
    repo_rev: &str,
) -> anyhow::Result<bool> {
    let result =
        sqlx::query(r#"UPDATE accounts SET repo_rev = $2, last_backup = NOW() WHERE did = $1"#)
            .bind(did)
            .bind(repo_rev)
            .execute(pool)
            .await?;
    Ok(result.rows_affected() > 0)
}

/// Update last_backup to the current timestamp for a given account identified by DID.
/// Returns true if a row was updated.
pub async fn update_last_backup_now_by_did(
    pool: &Pool<Postgres>,
    did: &str,
) -> anyhow::Result<bool> {
    let result = sqlx::query(r#"UPDATE accounts SET last_backup = NOW() WHERE did = $1"#)
        .bind(did)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
