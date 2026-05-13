use apalis::layers::retry::RetryPolicy;
use apalis::prelude::*;
use apalis_sql::{
    Config,
    postgres::{PgListen, PgPool, PostgresStorage},
};
use dotenvy::dotenv;
use log::{debug, info};
use s3::creds::Credentials;
use s3::{Bucket, Region};
use shared::jobs::account_backup::{AccountBackupJobContext, account_backup_job};
use shared::jobs::pds_backup::{PdsBackupJobContext, pds_backup_job};
use shared::jobs::remove_repo::RemoveRepoJobContext;
use shared::jobs::scheduled_back_up_start::{
    ScheduledBackUpStartJobContext, scheduled_back_up_start_job,
};
use shared::jobs::upload_blob::{UploadBlobJobContext, upload_blob_job};
use shared::jobs::{account_backup, pds_backup, remove_repo, scheduled_back_up_start, upload_blob};
use std::env;
use std::sync::Arc;
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

    let worker_node_name =
        std::env::var("WORKER_NODE_NAME").expect("Must specify worker node name");

    //job backend setup
    let database_url = std::env::var("DATABASE_URL").expect("Must specify path to db");

    let pool = PgPool::connect(&database_url).await?;

    let mut start_backup_storage: PostgresStorage<AccountBackupJobContext> =
        PostgresStorage::new_with_config(pool.clone(), Config::new(account_backup::JOB_NAMESPACE));

    let mut upload_blob_storage: PostgresStorage<UploadBlobJobContext> =
        PostgresStorage::new_with_config(pool.clone(), Config::new(upload_blob::JOB_NAMESPACE));

    let mut start_back_up_listener = PgListen::new(pool.clone()).await?;
    start_back_up_listener.subscribe_with(&mut start_backup_storage);

    let mut pull_blobs_listener = PgListen::new(pool.clone()).await?;
    pull_blobs_listener.subscribe_with(&mut upload_blob_storage);

    let mut pds_backup_storage: PostgresStorage<PdsBackupJobContext> =
        PostgresStorage::new_with_config(pool.clone(), Config::new(pds_backup::JOB_NAMESPACE));
    let mut pds_backup_listener = PgListen::new(pool.clone()).await?;
    pds_backup_listener.subscribe_with(&mut pds_backup_storage);

    let mut scheduled_backup_storage: PostgresStorage<ScheduledBackUpStartJobContext> =
        PostgresStorage::new_with_config(
            pool.clone(),
            Config::new(scheduled_back_up_start::JOB_NAMESPACE),
        );
    let mut scheduled_backup_listener = PgListen::new(pool.clone()).await?;
    scheduled_backup_listener.subscribe_with(&mut scheduled_backup_storage);

    let mut remove_repo_storage: PostgresStorage<RemoveRepoJobContext> =
        PostgresStorage::new_with_config(pool.clone(), Config::new(remove_repo::JOB_NAMESPACE));
    let mut remove_repo_listener = PgListen::new(pool.clone()).await?;
    remove_repo_listener.subscribe_with(&mut remove_repo_storage);

    tokio::spawn(async move {
        //TODO bad?
        start_back_up_listener.listen().await.unwrap();
        pull_blobs_listener.listen().await.unwrap();
        pds_backup_listener.listen().await.unwrap();
        scheduled_backup_listener.listen().await.unwrap();
        remove_repo_listener.listen().await.unwrap();
    });

    //Atrpoto client setup
    let atproto_client = Arc::new(
        reqwest::Client::builder()
            .user_agent("pds-moover-backups/0.0.1")
            .build()?,
    );

    //S3
    let region_name = env::var("S3_REGION")?;
    let endpoint = env::var("S3_ENDPOINT")?;
    let region = Region::Custom {
        region: region_name,
        endpoint,
    };

    let bucket = Bucket::new(
        env::var("S3_BUCKET_NAME")?.as_str(),
        region,
        // Credentials are collected from environment, config, profile or instance metadata
        Credentials::new(
            Some(env::var("S3_ACCESS_KEY")?.as_str()),
            Some(env::var("S3_SECRET_KEY")?.as_str()),
            None,
            None,
            None,
        )?,
    )?;

    let s3_bucket = Arc::new(bucket);

    log::info!("Starting the worker node: {}", worker_node_name);

    Monitor::new()
        .register({
            WorkerBuilder::new(format!("{}-start-backup", worker_node_name))
                .data(pool.clone())
                .data(atproto_client.clone())
                .concurrency(5)
                .retry(RetryPolicy::retries(5))
                .enable_tracing()
                .backend(start_backup_storage)
                .build_fn(account_backup_job)
        })
        .register({
            WorkerBuilder::new(format!("{}-upload-blob", worker_node_name))
                .data(pool.clone())
                .data(atproto_client.clone())
                .data(s3_bucket.clone())
                .concurrency(20)
                .retry(RetryPolicy::retries(5))
                .enable_tracing()
                .backend(upload_blob_storage)
                .build_fn(upload_blob_job)
            // .chain(|s| {
            //     //Should be a performance boost of the job
            //     s.map_future(|f| async {
            //         let fut = tokio::spawn(f);
            //         let fut = fut.await?;
            //         fut
            //     })
            // })
        })
        .register({
            WorkerBuilder::new(format!("{}-pds-backup", worker_node_name))
                .data(pool.clone())
                .data(atproto_client.clone())
                .retry(RetryPolicy::retries(1))
                .enable_tracing()
                .backend(pds_backup_storage)
                .build_fn(pds_backup_job)
        })
        .register({
            WorkerBuilder::new(format!("{}-scheduled-backup-start", worker_node_name))
                .data(pool.clone())
                .retry(RetryPolicy::retries(5))
                .enable_tracing()
                .backend(scheduled_backup_storage)
                .build_fn(scheduled_back_up_start_job)
        })
        .register({
            WorkerBuilder::new(format!("{}-delete-repo", worker_node_name))
                .data(pool.clone())
                .data(s3_bucket.clone())
                .retry(RetryPolicy::retries(5))
                .enable_tracing()
                .backend(remove_repo_storage)
                .build_fn(remove_repo::run)
        })
        .on_event(|e| debug!("{e}"))
        .run_with_signal(async {
            tokio::signal::ctrl_c().await?;
            info!("Shutting down the system");
            Ok(())
        })
        .await?;
    Ok(())
}
