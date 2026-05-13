use crate::db::models::{AccountModel, PdsHostModel};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::migrate::Migrator;
use sqlx::{FromRow, PgPool, postgres::PgPoolOptions};
use std::primitive::bool;

static MIGRATOR: Migrator = sqlx::migrate!(); // defaults to "./

pub mod models;
#[derive(Clone)]
pub struct Db {
    pool: PgPool,
}

impl Db {
    pub fn new(pool: &PgPool) -> Self {
        Db { pool: pool.clone() }
    }

    pub async fn connect(database_url: &str) -> Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;
        Ok(Self { pool })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn apply_migrations(&self) -> Result<()> {
        // The path is relative to this crate's Cargo.toml
        sqlx::migrate!().run(&self.pool).await?;
        Ok(())
    }

    pub async fn sign_up_new_account(&self, did: String, pds_host: String) -> Result<AccountModel> {
        Ok(sqlx::query_as::<_, AccountModel>(
            "INSERT INTO accounts (did, pds_host) VALUES ($1, $2) RETURNING *",
        )
        .bind(did)
        .bind(pds_host)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn update_account_pds_host(&self, did: &str, pds_host: &str) -> Result<u64> {
        let result =
            sqlx::query("UPDATE accounts SET pds_host = $2 WHERE did = $1 AND pds_host <> $2")
                .bind(did)
                .bind(pds_host)
                .execute(&self.pool)
                .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_blobs_by_did(&self, did: &str) -> Result<u64> {
        let result = sqlx::query("DELETE FROM blobs WHERE account_did = $1")
            .bind(did)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_missing_blobs_by_did(&self, did: &str) -> Result<u64> {
        // Table referenced in get_repo_status; delete any rows for this DID if present
        let result = sqlx::query("DELETE FROM missing_blobs WHERE did = $1")
            .bind(did)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_account_by_did(&self, did: &str) -> Result<u64> {
        let result = sqlx::query("DELETE FROM accounts WHERE did = $1")
            .bind(did)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Returns account and aggregate repo backup information for the given DID.
    ///
    /// This is intended to provide the data needed by the
    /// com.pdsmoover.backup.getRepoStatus endpoint handler.
    pub async fn get_repo_status(&self, did: &str) -> Result<Option<RepoStatusRow>> {
        let row = sqlx::query_as::<_, RepoStatusRow>(
            r#"
            SELECT
                a.active                                AS active,
                a.created_at                            AS created_at,
                a.did                                   AS did,
                a.repo_rev                              AS repo_rev,
                a.last_backup                           AS last_backup,
                a.pds_host                              AS pds_host,
                SUM(b.size)::BIGINT                     AS estimated_backup_size,
                COUNT(DISTINCT b.id)                    AS blob_count,
                COUNT(DISTINCT mb.id)                   AS missing_blob_count
            FROM accounts a
            LEFT JOIN blobs b ON b.account_did = a.did
            LEFT JOIN missing_blobs mb ON mb.did = a.did
            WHERE a.did = $1
            GROUP BY a.active, a.created_at, a.did, a.repo_rev, a.last_backup, a.pds_host
            "#,
        )
        .bind(did)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn is_user_already_registered(&self, did: &str) -> Result<bool> {
        let active = sqlx::query_scalar::<_, bool>(
            "SELECT active FROM accounts WHERE did = $1 AND active = TRUE",
        )
        .bind(did)
        .fetch_optional(&self.pool)
        .await?;

        match active {
            None => Ok(false),
            Some(active) => Ok(active),
        }
    }

    pub async fn sign_up_new_pds(
        &self,
        pds_host: &str,
        admin_did: Option<&str>,
    ) -> Result<PdsHostModel> {
        Ok(sqlx::query_as::<_, PdsHostModel>(
            "INSERT INTO pds_hosts (pds_host, admin_did)
             VALUES ($1, $2)
             ON CONFLICT (pds_host) DO UPDATE
                 SET active = TRUE,
                     admin_did = COALESCE(EXCLUDED.admin_did, pds_hosts.admin_did)
             RETURNING *",
        )
        .bind(pds_host)
        .bind(admin_did)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn is_pds_active(&self, pds_host: &str) -> Result<bool> {
        let active = sqlx::query_scalar::<_, bool>(
            "SELECT active FROM pds_hosts WHERE pds_host = $1 AND active = TRUE",
        )
        .bind(pds_host)
        .fetch_optional(&self.pool)
        .await?;

        Ok(active.unwrap_or(false))
    }
    pub async fn describe_server(&self) -> Result<DescribeServerRow> {
        // Aggregate server-wide stats.
        // Note: next_backup_due_at scheduling logic not defined; return NULL.
        let row = sqlx::query_as::<_, DescribeServerRow>(
            r#"
            SELECT
                -- Total number of active repos/accounts
                (SELECT COUNT(*)::BIGINT FROM accounts a WHERE a.active = TRUE)               AS total_repos,
                -- Total number of blobs tracked
                COALESCE((SELECT COUNT(*)::BIGINT FROM blobs), 0)                              AS total_blobs,
                -- Estimated blobs size on disk (sum of all blob sizes)
                COALESCE((SELECT SUM(size)::BIGINT FROM blobs), 0)                            AS estimated_blobs_size_on_disk,
                -- Estimated repos size (sum of sizes for repo/prefs types)
                COALESCE((SELECT SUM(size)::BIGINT FROM blobs WHERE type IN ('repo','prefs')), 0) AS estimated_repos_size_on_disk,
                -- Last backup time across all accounts
                (SELECT MAX(started_at) FROM network_backup_runs)                                        AS last_backup_at,
                -- Placeholder for next backup due at (unknown scheduling)
                NULL::TIMESTAMPTZ                                                              AS next_backup_due_at
        "#,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    /// Attempt to mark the start of a manual backup for the given DID.
    /// Returns whether the account exists, whether it is too soon since the last start,
    /// or whether we have successfully marked the start time.
    pub async fn try_start_manual_backup(
        &self,
        did: &str,
        min_interval: Duration,
    ) -> Result<ManualBackupStartOutcome> {
        // Define a wrapper struct for DateTime<Utc>
        #[derive(FromRow)]
        struct LastBackupRow {
            last_backup_started: Option<DateTime<Utc>>,
        }

        // Fetch last_backup_started for this account
        let rec = sqlx::query_as::<_, LastBackupRow>(
            r#"SELECT last_backup_started FROM accounts WHERE did = $1"#,
        )
        .bind(did)
        .fetch_optional(&self.pool)
        .await?;

        let Some(row) = rec else {
            return Ok(ManualBackupStartOutcome::NotFound);
        };

        // If a backup was started recently, don't start another
        if let Some(last_started) = row.last_backup_started {
            let threshold = chrono::Utc::now() - min_interval;
            if last_started > threshold {
                return Ok(ManualBackupStartOutcome::TooSoon {
                    last_backup_started: last_started,
                });
            }
        }

        // Update last_backup_started to NOW() to rate-limit subsequent calls
        let res = sqlx::query!(
            r#"UPDATE accounts SET last_backup_started = NOW() WHERE did = $1"#,
            did
        )
        .execute(&self.pool)
        .await?;

        if res.rows_affected() == 0 {
            // Extremely unlikely race: row deleted after read
            return Ok(ManualBackupStartOutcome::NotFound);
        }

        Ok(ManualBackupStartOutcome::Started)
    }

    pub async fn list_blobs(
        &self,
        did: &str,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<String>, Option<String>)> {
        let cids: Vec<String> = if let Some(cursor) = cursor {
            sqlx::query!(
                r#"
                SELECT DISTINCT cid_or_rev
                FROM blobs
                WHERE account_did = $1 AND type = 'blob' AND cid_or_rev > $2
                ORDER BY cid_or_rev
                LIMIT $3
                "#,
                did,
                cursor,
                limit
            )
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|row| row.cid_or_rev)
            .collect()
        } else {
            sqlx::query!(
                r#"
                SELECT DISTINCT cid_or_rev
                FROM blobs
                WHERE account_did = $1 AND type = 'blob'
                ORDER BY cid_or_rev
                LIMIT $2
                "#,
                did,
                limit
            )
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|row| row.cid_or_rev)
            .collect()
        };

        // Return cursor as the last CID if we hit the limit
        let next_cursor = if cids.len() == limit as usize {
            cids.last().cloned()
        } else {
            None
        };

        Ok((cids, next_cursor))
    }
}

#[derive(Debug, Clone)]
pub enum ManualBackupStartOutcome {
    NotFound,
    TooSoon { last_backup_started: DateTime<Utc> },
    Started,
}

/// Row returned by get_repo_status, containing account details and
/// aggregated blob info for the repo backup.
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct RepoStatusRow {
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub did: String,
    pub repo_rev: Option<String>,
    pub last_backup: Option<DateTime<Utc>>,
    pub pds_host: String,
    pub estimated_backup_size: Option<i64>,
    pub blob_count: Option<i64>,
    pub missing_blob_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct DescribeServerRow {
    pub total_repos: i64,
    pub total_blobs: i64,
    pub estimated_blobs_size_on_disk: i64,
    pub estimated_repos_size_on_disk: i64,
    pub last_backup_at: Option<DateTime<Utc>>,
    pub next_backup_due_at: Option<DateTime<Utc>>,
}
