use anyhow::{Context, anyhow};
use base64::Engine;
use clap::{Parser, Subcommand};
use dotenvy::dotenv;
use jacquard::url;
use jacquard_common::xrpc::XrpcExt;
use lexicon_types_crate::com_pdsmoover::admin::request_instance_backup::RequestInstanceBackup;
use lexicon_types_crate::com_pdsmoover::admin::request_pds_backup::RequestPdsBackup;
use lexicon_types_crate::com_pdsmoover::admin::request_repo_backup::RequestRepoBackup;
use lexicon_types_crate::com_pdsmoover::admin::sign_up_pds::SignUpPds;
use log;
use reqwest::header;
use reqwest::header::{HeaderMap, HeaderValue};
use s3::creds::Credentials;
use s3::{Bucket, Region};
use sqlx::PgPool;
use std::env;

fn init_logging() {
    // Load .env if present
    let _ = dotenv();

    // Initialize env_logger with default filter if RUST_LOG is not set
    let env = env_logger::Env::default().filter_or("RUST_LOG", "info");
    let _ = env_logger::Builder::from_env(env).try_init();
}

/// Admin CLI for pds_moover
#[derive(Debug, Parser)]
#[command(name = "admin_cli", version, about = "Administrative CLI for pds_moover", long_about = None)]
struct Cli {
    /// Admin password (optional). If not provided, the program will read the `admin_password` environment variable.
    #[arg(short = 'p', long = "admin-password", global = true)]
    admin_password: Option<String>,

    /// PDS MOOver endpoint (optional). If not provided, the program will call the default endpoint at https://pdsmoover.com.
    #[arg(short = 'm', long = "moover-host", global = true)]
    pds_moover_host: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// PDS related administrative actions
    Pds {
        #[command(subcommand)]
        action: PdsAction,
    },
    /// Repo related administrative actions
    Repo {
        #[command(subcommand)]
        action: RepoAction,
    },
    /// Trigger an instance-wide backup job (no parameters)
    RequestInstanceBackup,
    /// Verify all backups in S3 against the database
    VerifyBackups,
}

#[derive(Debug, Subcommand)]
enum PdsAction {
    /// Sign up a PDS by hostname
    Signup {
        /// Hostname of the PDS to sign up
        hostname: String,
    },
    /// Request a backup for a PDS by hostname
    RequestBackup {
        /// Hostname of the PDS to back up
        hostname: String,
    },

    /// Remove a PDS by hostname (not yet implemented server-side)
    Remove {
        /// Hostname of the PDS to remove
        hostname: String,
    },
}

#[derive(Debug, Subcommand)]
enum RepoAction {
    /// Request a backup for a specific repo DID
    RequestBackup {
        /// DID of the repo to back up
        did: String,
    },
}

fn resolve_admin_password(opt: &Option<String>) -> anyhow::Result<String> {
    if let Some(pw) = opt.as_ref() {
        return Ok(pw.clone());
    }
    match env::var("ADMIN_PASSWORD") {
        Ok(val) if !val.is_empty() => Ok(val),
        _ => Err(anyhow!(
            "Admin password not provided. Pass --admin-password or set env var ADMIN_PASSWORD"
        )),
    }
}

fn build_basic_auth_header(admin_password: &str) -> HeaderValue {
    // Build Basic base64("admin:<password>") per temporary spec
    let creds = format!("admin:{}", admin_password);
    let encoded = base64::engine::general_purpose::STANDARD.encode(creds.as_bytes());
    let value = format!("Basic {}", encoded);
    // Safe unwrap: constructing from known ASCII
    HeaderValue::from_str(&value).expect("valid basic auth header")
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_logging();

    let cli = Cli::parse();
    let admin_password =
        resolve_admin_password(&cli.admin_password).context("failed to resolve admin password")?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::AUTHORIZATION,
        build_basic_auth_header(&admin_password),
    );

    let http = reqwest::Client::builder()
        .default_headers(headers)
        .user_agent("PDS MOOver Admin cli/0.0.1")
        .build()?;

    let base = url::Url::parse(
        cli.pds_moover_host
            .as_deref()
            // TODO: change this away from dev in prod
            .unwrap_or("https://pdsmoover.com"),
    )?;

    match cli.command {
        Commands::Pds { action } => match action {
            PdsAction::Signup { hostname } => {
                log::info!("Signing up PDS");

                let req = SignUpPds {
                    hostname: hostname.clone().into(),
                    extra_data: Default::default(),
                };
                // Send the typed XRPC request
                match http.xrpc(base.clone()).send(&req).await {
                    Ok(result) => {
                        if result.status().is_success() {
                            log::info!("Sign up request sent successfully for: {}", hostname);
                        } else {
                            let error = result.parse().unwrap_err();
                            log::error!("Sign up request failed: {}", error);
                        }
                    }
                    Err(err) => {
                        log::error!("Sign up request failed: {}", err);
                    }
                }
            }
            PdsAction::RequestBackup { hostname } => {
                log::info!("Requesting PDS backup for host: {}", hostname);
                let req = RequestPdsBackup {
                    hostname: hostname.clone().into(),
                    extra_data: Default::default(),
                };

                match http.xrpc(base.clone()).send(&req).await {
                    Ok(result) => {
                        if result.status().is_success() {
                            log::info!(
                                "PDS backup request enqueued successfully for: {}",
                                hostname
                            );
                        } else {
                            let error = result.parse().unwrap_err();
                            log::error!("PDS backup request failed: {}", error);
                        }
                    }
                    Err(err) => {
                        log::error!("PDS backup request failed: {}", err);
                    }
                }
            }
            PdsAction::Remove { hostname: _ } => {
                log::info!("Removing PDS (not implemented yet)");
                // TODO: Implement call to backend API for removal when endpoint is available
            }
        },
        Commands::Repo { action } => match action {
            RepoAction::RequestBackup { did } => {
                log::info!("Requesting repo backup for DID: {}", did);
                let req = RequestRepoBackup {
                    did: did.clone().into(),
                    extra_data: Default::default(),
                };
                match http.xrpc(base).send(&req).await {
                    Ok(result) => {
                        if result.status().is_success() {
                            log::info!("Repo backup request enqueued successfully for: {}", did);
                        } else {
                            let error = result.parse().unwrap_err();
                            log::error!("Repo backup request failed: {}", error);
                        }
                    }
                    Err(err) => {
                        log::error!("Repo backup request failed: {}", err);
                    }
                }
            }
        },
        Commands::RequestInstanceBackup => {
            log::info!("Requesting instance-wide backup start");
            let req = RequestInstanceBackup;
            match http.xrpc(base.clone()).send(&req).await {
                Ok(result) => {
                    if result.status().is_success() {
                        log::info!("Instance backup start enqueued successfully");
                    } else {
                        let error = result.parse().unwrap_err();
                        log::error!("Instance backup request failed: {}", error);
                    }
                }
                Err(err) => {
                    log::error!("Instance backup request failed: {}", err);
                }
            }
        }
        Commands::VerifyBackups => {
            //Not really a part of the cli per say. But I needed it and is a good place as any
            log::info!("Verifying backups in S3...");

            // Get database URL from environment
            let database_url =
                env::var("DATABASE_URL").context("DATABASE_URL environment variable not set")?;

            // Connect to database
            let pool = PgPool::connect(&database_url)
                .await
                .context("Failed to connect to database")?;

            // Setup S3 client
            let region_name = env::var("S3_REGION")?;
            let endpoint = env::var("S3_ENDPOINT")?;
            let region = Region::Custom {
                region: region_name,
                endpoint,
            };
            let bucket = Bucket::new(
                env::var("S3_BUCKET_NAME")?.as_str(),
                region,
                Credentials::new(
                    Some(env::var("S3_ACCESS_KEY")?.as_str()),
                    Some(env::var("S3_SECRET_KEY")?.as_str()),
                    None,
                    None,
                    None,
                )?,
            )?;

            // Call the verify_backups function
            match shared::jobs::verify_backups::verify_backups(&pool, &bucket).await {
                Ok(missing_blobs) => {
                    if missing_blobs.is_empty() {
                        log::info!("✓ All backups verified successfully! No missing blobs found.");
                    } else {
                        log::error!("✗ Found {} missing blobs:", missing_blobs.len());
                        for missing in &missing_blobs {
                            println!(
                                "Missing: DID={}, CID/REV={}, TYPE={:?}, PATH={}",
                                missing.did, missing.cid_or_rev, missing.blob_type, missing.s3_path
                            );
                        }
                    }
                }
                Err(err) => {
                    log::error!("Failed to verify backups: {}", err);
                }
            }
        }
    }

    Ok(())
}
