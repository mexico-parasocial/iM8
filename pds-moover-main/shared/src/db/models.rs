use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Debug, PartialEq, PartialOrd, sqlx::Type, Deserialize, Serialize)]
#[sqlx(type_name = "blob_type", rename_all = "lowercase")]
pub enum BlobType {
    Repo,
    Blob,
    Prefs,
}

impl BlobType {
    pub fn to_string(&self) -> String {
        match self {
            BlobType::Repo => "repo".to_string(),
            BlobType::Blob => "blob".to_string(),
            BlobType::Prefs => "prefs".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AccountModel {
    pub id: i64,
    pub did: String,
    pub pds_host: String,
    pub active: bool,
    pub repo_rev: Option<String>,
    /// If the whole PDS was signed up set this as true to know to clean up if the PDS is removed.
    pub pds_sign_up: bool,
    pub last_backup: Option<DateTime<Utc>>,
    pub last_backup_started: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct BlobModel {
    pub id: i32,
    pub created_at: DateTime<Utc>,
    pub account_did: String,
    pub size: i64,
    pub r#type: BlobType,
    pub cid_or_rev: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PdsHostModel {
    pub pds_host: String,
    pub created: DateTime<Utc>,
    pub active: bool,
    pub admin_did: Option<String>,
}
