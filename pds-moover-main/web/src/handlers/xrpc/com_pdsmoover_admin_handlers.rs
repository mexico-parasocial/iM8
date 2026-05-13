use crate::AppState;
use crate::handlers::xrpc::{XrpcError, XrpcErrorResponse, admin_basic_auth_middleware};
use axum::extract::State;
use axum::http::StatusCode;
use axum::{Router, middleware};
use jacquard_api::com_atproto::server::describe_server::DescribeServer;
use jacquard_axum::{ExtractXrpc, IntoRouter};
use jacquard_common::url::Url;
use jacquard_common::xrpc::XrpcExt;
use lexicon_types_crate::com_pdsmoover::admin::request_instance_backup::RequestInstanceBackupRequest;
use lexicon_types_crate::com_pdsmoover::admin::request_pds_backup::{
    RequestPdsBackupError, RequestPdsBackupRequest,
};
use lexicon_types_crate::com_pdsmoover::admin::request_repo_backup::{
    RequestRepoBackupError, RequestRepoBackupRequest,
};
use lexicon_types_crate::com_pdsmoover::admin::sign_up_pds::{SignUpPdsError, SignUpPdsRequest};
use shared::jobs::account_backup::{self, AccountBackupJobContext};
use shared::jobs::pds_backup::PdsBackupJobContext;
use shared::jobs::scheduled_back_up_start::{self, ScheduledBackUpStartJobContext};
use shared::jobs::{pds_backup, push_job_json};

#[axum_macros::debug_handler]
async fn sign_up_pds_handler(
    State(state): State<AppState>,
    ExtractXrpc(args): ExtractXrpc<SignUpPdsRequest>,
) -> Result<StatusCode, XrpcErrorResponse> {
    let hostname = args.hostname.to_string();
    let base_url = if hostname.starts_with("https://") {
        Url::parse(&hostname).map_err(|err| {
            tracing::error!(error = %err, host = %hostname, "Invalid hostname URL");
            return XrpcErrorResponse {
                error: XrpcError {
                    error: SignUpPdsError::NotAValidPds(None).to_string(),
                    message: None,
                },
                status: StatusCode::BAD_REQUEST,
            };
        })?
    } else {
        // Default to https if no scheme is provided
        Url::parse(&format!("https://{}", hostname)).map_err(|err| {
            tracing::error!(error = %err, host = %hostname, "Failed to build base URL");
            return XrpcErrorResponse {
                error: XrpcError {
                    error: SignUpPdsError::NotAValidPds(None).to_string(),
                    message: None,
                },
                status: StatusCode::BAD_REQUEST,
            };
        })?
    };

    let http = reqwest::Client::new();

    // Attempt to call describeServer; treat any error as NotAValidPds
    match http.xrpc(base_url.clone()).send(&DescribeServer).await {
        Ok(resp) => {
            // Ensure the response parses as DescribeServerOutput
            if let Err(parse_err) = resp.parse() {
                tracing::warn!(error = %parse_err, host = %hostname, "describeServer parse failed; treating as NotAValidPDS");
                return Err(XrpcErrorResponse {
                    error: XrpcError {
                        error: SignUpPdsError::NotAValidPds(None).to_string(),
                        message: None,
                    },
                    status: StatusCode::BAD_REQUEST,
                });
            }
        }
        Err(err) => {
            tracing::warn!(error = %err, host = %hostname, "describeServer call failed; treating as NotAValidPDS");
            return Err(XrpcErrorResponse {
                error: XrpcError {
                    error: SignUpPdsError::NotAValidPds(None).to_string(),
                    message: None,
                },
                status: StatusCode::BAD_REQUEST,
            });
        }
    }

    // If we got here, the PDS looks valid; insert or activate it in the DB
    match state
        .db
        //TODO prob should handle this better but i don't see base_url.host being empty
        .sign_up_new_pds(&base_url.host().unwrap().to_string(), None)
        .await
    {
        Ok(pds) => {
            _ = push_job_json(
                &state.db.pool(),
                pds_backup::JOB_NAMESPACE,
                &PdsBackupJobContext {
                    pds_host: pds.pds_host,
                },
            )
            .await;
            Ok(StatusCode::OK)
        }
        Err(err) => {
            tracing::error!(error = %err, host = %hostname, "DB error signing up PDS");
            Err(XrpcErrorResponse::internal_server_error())
        }
    }
}

#[axum_macros::debug_handler]
async fn request_repo_backup_handler(
    State(state): State<AppState>,
    ExtractXrpc(args): ExtractXrpc<RequestRepoBackupRequest>,
) -> Result<StatusCode, XrpcErrorResponse> {
    let did = args.did.to_string();

    // Look up the account to find its source PDS host
    let repo_status = state.db.get_repo_status(&did).await.map_err(|err| {
        tracing::error!(error = %err, did = %did, "DB error looking up repo status");
        XrpcErrorResponse::internal_server_error()
    })?;

    let Some(status_row) = repo_status else {
        return Err(XrpcErrorResponse {
            error: XrpcError {
                error: RequestRepoBackupError::NotFound(None).to_string(),
                message: Some(format!("Account not found for DID: {}", did)),
            },
            status: StatusCode::BAD_REQUEST,
        });
    };

    // Enqueue an account backup job for this DID
    push_job_json(
        &state.db.pool(),
        account_backup::JOB_NAMESPACE,
        &AccountBackupJobContext {
            did,
            pds_host: status_row.pds_host,
            //Want the job to get a fresh repo state from the PDS
            rev: None,
        },
    )
    .await
    .map_err(|err| {
        tracing::error!(error = %err, "Failed to enqueue account backup job");
        XrpcErrorResponse::internal_server_error()
    })?;

    Ok(StatusCode::OK)
}

#[axum_macros::debug_handler]
async fn request_pds_backup_handler(
    State(state): State<AppState>,
    ExtractXrpc(args): ExtractXrpc<RequestPdsBackupRequest>,
) -> Result<StatusCode, XrpcErrorResponse> {
    let hostname = args.hostname.to_string();

    // Normalize to a host string
    let base_url = if hostname.starts_with("https://") {
        Url::parse(&hostname).map_err(|err| {
            tracing::error!(error = %err, host = %hostname, "Invalid hostname URL");
            return XrpcErrorResponse {
                error: XrpcError {
                    error: RequestPdsBackupError::NotFound(None).to_string(),
                    message: Some("Invalid hostname".to_string()),
                },
                status: StatusCode::BAD_REQUEST,
            };
        })?
    } else {
        // Default to https if no scheme is provided
        Url::parse(&format!("https://{}", hostname)).map_err(|err| {
            tracing::error!(error = %err, host = %hostname, "Failed to build base URL");
            return XrpcErrorResponse {
                error: XrpcError {
                    error: RequestPdsBackupError::NotFound(None).to_string(),
                    message: Some("Invalid hostname".to_string()),
                },
                status: StatusCode::BAD_REQUEST,
            };
        })?
    };

    let host = match base_url.host() {
        Some(h) => h.to_string(),
        None => {
            return Err(XrpcErrorResponse {
                error: XrpcError {
                    error: RequestPdsBackupError::NotFound(None).to_string(),
                    message: Some("Missing host".to_string()),
                },
                status: StatusCode::BAD_REQUEST,
            });
        }
    };

    // Ensure the PDS host exists in DB and is active before scheduling a backup
    let is_active = state.db.is_pds_active(&host).await.map_err(|err| {
        tracing::error!(error = %err, host = %host, "DB error checking pds host active");
        XrpcErrorResponse::internal_server_error()
    })?;

    if !is_active {
        return Err(XrpcErrorResponse {
            error: XrpcError {
                error: RequestPdsBackupError::NotFound(None).to_string(),
                message: Some("PDS host not found or inactive".to_string()),
            },
            status: StatusCode::BAD_REQUEST,
        });
    }

    // Enqueue a PDS backup job for this host. That job will discover repos and enqueue per-account backups.
    push_job_json(
        &state.db.pool(),
        pds_backup::JOB_NAMESPACE,
        &PdsBackupJobContext { pds_host: host },
    )
    .await
    .map_err(|err| {
        tracing::error!(error = %err, "Failed to enqueue pds backup job");
        XrpcErrorResponse::internal_server_error()
    })?;

    Ok(StatusCode::OK)
}

#[axum_macros::debug_handler]
async fn request_instance_backup_handler(
    State(state): State<AppState>,
    ExtractXrpc(_args): ExtractXrpc<RequestInstanceBackupRequest>,
) -> Result<StatusCode, XrpcErrorResponse> {
    // Enqueue the instance-wide scheduled backup start job. This job will enqueue
    // per-account AccountBackup jobs and PDS backups as needed.
    push_job_json(
        &state.db.pool(),
        scheduled_back_up_start::JOB_NAMESPACE,
        &ScheduledBackUpStartJobContext,
    )
    .await
    .map_err(|err| {
        tracing::error!(error = %err, "Failed to enqueue scheduled instance backup start job");
        XrpcErrorResponse::internal_server_error()
    })?;

    Ok(StatusCode::OK)
}

pub fn admin_routes(state: AppState) -> Router<AppState> {
    let sign_up = SignUpPdsRequest::into_router(sign_up_pds_handler).route_layer(
        middleware::from_fn_with_state(state.clone(), admin_basic_auth_middleware),
    );

    let request_repo_backup =
        RequestRepoBackupRequest::into_router(request_repo_backup_handler).route_layer(
            middleware::from_fn_with_state(state.clone(), admin_basic_auth_middleware),
        );

    let request_pds_backup =
        RequestPdsBackupRequest::into_router(request_pds_backup_handler).route_layer(
            middleware::from_fn_with_state(state.clone(), admin_basic_auth_middleware),
        );

    let request_instance_backup =
        RequestInstanceBackupRequest::into_router(request_instance_backup_handler).route_layer(
            middleware::from_fn_with_state(state.clone(), admin_basic_auth_middleware),
        );

    Router::new()
        .merge(sign_up)
        .merge(request_repo_backup)
        .merge(request_pds_backup)
        .merge(request_instance_backup)
}
