use crate::jobs::scheduled_back_up_start::ScheduledBackUpStartJobContext;
use crate::jobs::{push_job_json, scheduled_back_up_start};
use apalis::prelude::{Data, Error};
use apalis_cron::CronContext;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
pub struct InstanceWideBackup;

pub async fn start_all_backup(
    _job: InstanceWideBackup,
    _ctx: CronContext<Utc>,
    pool: Data<Pool<Postgres>>,
) -> Result<(), Error> {
    log::info!("Starting whole-network backup run.");
    push_job_json(
        &*pool,
        scheduled_back_up_start::JOB_NAMESPACE,
        &ScheduledBackUpStartJobContext,
    )
    .await?;
    Ok::<(), Error>(())
}
