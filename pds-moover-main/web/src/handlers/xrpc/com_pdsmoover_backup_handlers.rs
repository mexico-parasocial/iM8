use crate::AppState;
use crate::handlers::xrpc::{
    VerifiedServiceAuthResults, XrpcError, XrpcErrorResponse, service_auth_middleware,
};
use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::middleware::{self};
use axum::{Json, Router};
use jacquard_axum::{ExtractXrpc, IntoRouter};
use jacquard_common::CowStr;
use jacquard_common::chrono::DateTime;
use jacquard_common::chrono::{Duration, Utc};
use lexicon_types_crate::com_pdsmoover::backup::describe_server::{
    DescribeServerOutput, DescribeServerRequest,
};
use lexicon_types_crate::com_pdsmoover::backup::get_repo_status::{
    GetRepoStatusError, GetRepoStatusOutput, GetRepoStatusRequest,
};
use lexicon_types_crate::com_pdsmoover::backup::remove_repo::RemoveRepoRequest;
use lexicon_types_crate::com_pdsmoover::backup::request_backup::RequestBackupRequest;
use lexicon_types_crate::com_pdsmoover::backup::sign_up::{SignUpError, SignUpRequest};
use shared::db::ManualBackupStartOutcome;
use shared::jobs::account_backup::AccountBackupJobContext;
use shared::jobs::{account_backup, push_job_json, remove_repo};

#[axum_macros::debug_handler]
async fn sign_up_handler(
    State(state): State<AppState>,
    Extension(verified): Extension<VerifiedServiceAuthResults>,
) -> Result<StatusCode, XrpcErrorResponse> {
    // First, check if this DID is already registered
    if state.db.is_user_already_registered(&verified.did).await.map_err(|err| {
        tracing::error!(error = %err, did = %verified.did, "Error checking if DID is already registered");
        XrpcErrorResponse::internal_server_error()
    })? {
        return Err(XrpcErrorResponse {
            error: XrpcError {
                error: SignUpError::AlreadyRegistered(None).to_string(),
                message: None,
            },
            status: StatusCode::CONFLICT,
        });
    }

    match state
        .db
        .sign_up_new_account(
            verified.did.clone(),
            //TODO bad unwrap
            verified.pds_url.host().unwrap().to_string(),
        )
        .await
    {
        Ok(account) => {
            push_job_json(
                &state.db.pool(),
                account_backup::JOB_NAMESPACE,
                &AccountBackupJobContext {
                    did: account.did.clone(),
                    rev: None,
                    pds_host: account.pds_host.clone(),
                },
            )
            .await
            .map_err(|err| {
                tracing::error!(error = %err, "Failed to enqueue pds backup job");
                XrpcErrorResponse::internal_server_error()
            })?;
            Ok(StatusCode::OK)
        }
        Err(err) => {
            tracing::error!(error = %err, did = %verified.did, "Error signing up new account");
            Err(XrpcErrorResponse::internal_server_error())
        }
    }
}

#[axum_macros::debug_handler]
async fn get_repo_status_handler(
    State(state): State<AppState>,
    ExtractXrpc(args): ExtractXrpc<GetRepoStatusRequest>,
) -> Result<Json<GetRepoStatusOutput<'static>>, XrpcErrorResponse> {
    match state.db.get_repo_status(&args.did).await {
        Ok(result) => match result {
            None => Err(XrpcErrorResponse {
                error: XrpcError {
                    error: GetRepoStatusError::RepoNotFound(None).to_string(),
                    message: None,
                },
                status: StatusCode::BAD_REQUEST,
            }),
            Some(result) => Ok(Json(GetRepoStatusOutput {
                active: result.active,
                created_at: jacquard_common::types::string::Datetime::new(DateTime::from(
                    result.created_at,
                )),
                did: args.did,
                estimated_backup_size: result.estimated_backup_size,
                blob_count: result.blob_count,
                missing_blob_count: result.missing_blob_count,
                last_backup: match result.last_backup {
                    None => None,
                    Some(date) => Some(jacquard_common::types::string::Datetime::new(
                        DateTime::from(date),
                    )),
                },
                rev: match result.repo_rev {
                    None => None,
                    Some(tid) => {
                        let parsed_tid: jacquard_common::types::string::Tid =
                            tid.parse().map_err(|err| {
                                tracing::error!("Error parsing tid: {err}");
                                XrpcErrorResponse::internal_server_error()
                            })?;
                        Some(parsed_tid)
                    }
                },
                source: Some(CowStr::from(result.pds_host)),
                extra_data: Default::default(),
            })),
        },
        Err(err) => {
            tracing::error!("Error getting repo status: {}", err);
            Err(XrpcErrorResponse::internal_server_error())
        }
    }
}

#[axum_macros::debug_handler]
async fn describe_server_handler(
    State(state): State<AppState>,
) -> Result<Json<DescribeServerOutput<'static>>, XrpcErrorResponse> {
    // Check cache first
    let now = Utc::now();
    let cached = state.describe_server_cache.read().await.clone();
    if let Some((row, updated_at)) = cached {
        if now.signed_duration_since(updated_at) < Duration::minutes(10) {
            let output = DescribeServerOutput {
                estimated_blobs_size_on_disk: row.estimated_blobs_size_on_disk,
                estimated_repos_size_on_disk: row.estimated_repos_size_on_disk,
                last_backup_at: row
                    .last_backup_at
                    .map(|dt| jacquard_common::types::string::Datetime::new(DateTime::from(dt))),
                next_backup_due_at: row
                    .next_backup_due_at
                    .map(|dt| jacquard_common::types::string::Datetime::new(DateTime::from(dt))),
                status_last_updated: jacquard_common::types::string::Datetime::new(DateTime::from(
                    updated_at,
                )),
                total_blobs: row.total_blobs,
                total_repos: row.total_repos,
                extra_data: Default::default(),
            };
            return Ok(Json(output));
        }
    }

    // Fetch fresh data from DB and update cache
    let row = state.db.describe_server().await.map_err(|err| {
        tracing::error!(error = %err, "Error describing server");
        XrpcErrorResponse::internal_server_error()
    })?;

    {
        let mut w = state.describe_server_cache.write().await;
        *w = Some((row.clone(), now));
    }

    let output = DescribeServerOutput {
        estimated_blobs_size_on_disk: row.estimated_blobs_size_on_disk,
        estimated_repos_size_on_disk: row.estimated_repos_size_on_disk,
        last_backup_at: row
            .last_backup_at
            .map(|dt| jacquard_common::types::string::Datetime::new(DateTime::from(dt))),
        next_backup_due_at: row
            .next_backup_due_at
            .map(|dt| jacquard_common::types::string::Datetime::new(DateTime::from(dt))),
        status_last_updated: jacquard_common::types::string::Datetime::new(DateTime::from(now)),
        total_blobs: row.total_blobs,
        total_repos: row.total_repos,
        extra_data: Default::default(),
    };

    Ok(Json(output))
}

#[axum_macros::debug_handler]
async fn request_backup_handler(
    State(state): State<AppState>,
    Extension(verified): Extension<VerifiedServiceAuthResults>,
) -> Result<StatusCode, XrpcErrorResponse> {
    // Ensure stored pds_host is up-to-date with the verified pds_url
    if let Some(host) = verified.pds_url.host() {
        let host_string = host.to_string();
        if let Err(err) = state
            .db
            .update_account_pds_host(&verified.did, &host_string)
            .await
        {
            // Do not block the backup request if this best-effort update fails
            tracing::error!(error = %err, did = %verified.did, new_host = %host_string, "Failed to update account pds_host to latest verified host");
        }
    } else {
        tracing::error!(did = %verified.did, url = %verified.pds_url, "Verified pds_url had no host component");
    }

    match state
        .db
        .try_start_manual_backup(&verified.did, Duration::minutes(5))
        .await
        .map_err(|err| {
            tracing::error!(error = %err, did = %verified.did, "Failed to check/manual start backup");
            XrpcErrorResponse::internal_server_error()
        })? {
        ManualBackupStartOutcome::NotFound => {
            return Err(XrpcErrorResponse {
                error: XrpcError {
                    error: "RepoNotFound".to_string(),
                    message: Some("Account/repo not found".to_string()),
                },
                status: StatusCode::BAD_REQUEST,
            });
        }
        ManualBackupStartOutcome::TooSoon { .. } => {
            return Err(XrpcErrorResponse {
                error: XrpcError {
                    error: "TooManyRequests".to_string(),
                    message: Some("A backup was started recently. Please wait up to 5 minutes before starting another.".to_string()),
                },
                status: StatusCode::TOO_MANY_REQUESTS,
            });
        }
        ManualBackupStartOutcome::Started => {
            push_job_json(
                &state.db.pool(),
                account_backup::JOB_NAMESPACE,
                &AccountBackupJobContext {
                    did: verified.did.clone(),
                    //TODO bad unwrap
                    pds_host: verified.pds_url.host().unwrap().to_string(),
                    rev: None,
                },
            )
                .await
                .map_err(|err| {
                    tracing::error!(error = %err, "Failed to enqueue remove repo job");
                    XrpcErrorResponse::internal_server_error()
                })?;
            Ok(StatusCode::OK)

        }
    }
}

#[axum_macros::debug_handler]
async fn remove_repo_handler(
    State(state): State<AppState>,
    Extension(verified): Extension<VerifiedServiceAuthResults>,
) -> Result<StatusCode, XrpcErrorResponse> {
    let did = verified.did.clone();

    // Enqueue the background job to remove the repo and associated data
    push_job_json(
        &state.db.pool(),
        remove_repo::JOB_NAMESPACE,
        &remove_repo::RemoveRepoJobContext { did },
    )
    .await
    .map_err(|err| {
        tracing::error!(error = %err, "Failed to enqueue remove repo job");
        XrpcErrorResponse::internal_server_error()
    })?;

    Ok(StatusCode::OK)
}

pub fn backup_routes(state: AppState) -> Router<AppState> {
    let signup = SignUpRequest::into_router(sign_up_handler).route_layer(
        middleware::from_fn_with_state(state.clone(), service_auth_middleware),
    );

    let request_backup = RequestBackupRequest::into_router(request_backup_handler).route_layer(
        middleware::from_fn_with_state(state.clone(), service_auth_middleware),
    );

    let remove_repo = RemoveRepoRequest::into_router(remove_repo_handler).route_layer(
        middleware::from_fn_with_state(state.clone(), service_auth_middleware),
    );

    Router::new()
        .merge(GetRepoStatusRequest::into_router(get_repo_status_handler))
        .merge(DescribeServerRequest::into_router(describe_server_handler))
        .merge(signup)
        .merge(request_backup)
        .merge(remove_repo)
}
