use apalis::prelude::*;
use apalis_cron::{CronStream, Schedule};
use apalis_sql::postgres::PgPool;
use apalis_sql::sqlx::types::chrono::Utc;
use dotenvy::dotenv;
use log::{debug, info};
use shared::jobs::start_all_backup::start_all_backup;
use std::env;
use std::str::FromStr;
use std::time::Duration;
use tower::load_shed::LoadShedLayer;
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    use tracing_subscriber::EnvFilter;
    let _ = dotenv();
    let fmt_layer = tracing_subscriber::fmt::layer().with_target(false);
    let filter_layer =
        EnvFilter::try_from_default_env().or_else(|_| EnvFilter::try_new("debug"))?;
    tracing_subscriber::registry()
        .with(filter_layer)
        .with(fmt_layer)
        .init();

    // Job backend setup (DB only needed to record/run backups in start_all_backup)
    let database_url = std::env::var("DATABASE_URL").expect("Must specify path to db");
    let pool = PgPool::connect(&database_url).await?;

    // Default to run at the 0th second and minute of every hour, i.e. every hour
    // Job is currently set to only do backups within a 24 hour period
    // 6-field cron: second minute hour day month weekday
    let backup_schedule = env::var("BACKUP_SCHEDULE").unwrap_or("0 0 */1 * * *".to_string());
    let schedule = Schedule::from_str(backup_schedule.as_str()).unwrap();
    log::info!("Using BACKUP_SCHEDULE: {}", backup_schedule);

    Monitor::new()
        .register({
            WorkerBuilder::new("cron-start")
                .data(pool.clone())
                .enable_tracing()
                .layer(LoadShedLayer::new())
                //Can be removed just a small safe guard if something goes wrong to help catch overloading the job runner
                .rate_limit(1, Duration::from_secs(60 * 5))
                .backend(CronStream::new_with_timezone(schedule, Utc))
                .build_fn(start_all_backup)
        })
        .on_event(|e| debug!("{e}"))
        .run_with_signal(async {
            tokio::signal::ctrl_c().await?;
            info!("Shutting down the cron worker");
            Ok(())
        })
        .await?;

    Ok(())
}
