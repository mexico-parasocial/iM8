use crate::AppState;
use crate::handlers::xrpc::{XrpcError, XrpcErrorResponse};
use async_compression::tokio::bufread::ZstdDecoder;
use axum::{
    Router,
    body::Body,
    extract::State,
    http::{StatusCode, header},
    response::Response,
};
use jacquard_axum::{ExtractXrpc, IntoRouter};
use lexicon_types_crate::{
    com_atproto::sync::get_blob::GetBlobRequest, com_atproto::sync::get_repo::GetRepoRequest,
    com_atproto::sync::list_blobs::ListBlobsRequest,
};
use s3::error::S3Error;
use shared::storage::{blob_backup_path, repo_backup_path};
use tokio::io::BufReader;
use tokio_util::compat::FuturesAsyncReadCompatExt;
use tokio_util::io::ReaderStream;

#[axum_macros::debug_handler]
async fn get_repo(
    State(state): State<AppState>,
    ExtractXrpc(args): ExtractXrpc<GetRepoRequest>,
) -> Result<Response, XrpcErrorResponse> {
    let did = args.did.to_string();
    let path = repo_backup_path(did.clone());
    //TODO this works but i'd like to get streaming working here as well

    // Download the compressed CAR file from S3 (buffered)
    let s3_obj = state.s3_bucket.get_object(path).await.map_err(|e| {
        //TODO prob need to check if it's not found and return a different error here
        return match e {
            S3Error::HttpFailWithBody(status_code, _) => {
                if status_code == 404 {
                    //TODO find a way to use the generated type errors into xrpc error response
                    return XrpcErrorResponse {
                        error: XrpcError {
                            error: "RepoNotFound".to_string(),
                            message: Some(format!("Could not find repo for DID: {did}")),
                        },
                        status: StatusCode::BAD_REQUEST,
                    };
                };
                tracing::error!(%e, "failed to get object");
                XrpcErrorResponse::internal_server_error()
            }
            _ => {
                tracing::error!(%e, "failed to get object");
                XrpcErrorResponse::internal_server_error()
            }
        };
    })?;

    // let content_type = s3_obj.headers().get("content-type");

    // Build an AsyncRead over in-memory bytes and convert to Tokio AsyncRead
    let data = s3_obj.bytes().to_vec();
    let fut_cursor = futures::io::Cursor::new(data);
    let reader = fut_cursor.compat();

    // Wrap the AsyncRead in a BufReader to satisfy AsyncBufRead for the decoder
    let buf_reader = BufReader::new(reader);

    // Zstd decode the stream on-the-fly
    let decoder = ZstdDecoder::new(buf_reader);

    // Convert the AsyncRead decoder into a Stream of Bytes for Axum Body
    let decoded_stream = ReaderStream::new(decoder);
    let body = Body::from_stream(decoded_stream);

    let response = Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/vnd.ipld.car")
        .body(body)
        .map_err(|_| XrpcErrorResponse::internal_server_error())?;

    Ok(response)
}

#[axum_macros::debug_handler]
async fn get_blob(
    State(state): State<AppState>,
    ExtractXrpc(args): ExtractXrpc<GetBlobRequest>,
) -> Result<Response, XrpcErrorResponse> {
    let did = args.did.to_string();
    let cid = args.cid.to_string();
    let path = blob_backup_path(did, cid);
    //TODO this works but i'd like to get streaming working here as well

    // Download the compressed CAR file from S3 (buffered)
    let s3_obj = state.s3_bucket.get_object(path).await.map_err(|e| {
        //TODO prob need to check if it's not found and return a different error here
        return match e {
            S3Error::HttpFailWithBody(status_code, _) => {
                if status_code == 404 {
                    //TODO find a way to use the generated type errors into xrpc error response
                    return XrpcErrorResponse {
                        error: XrpcError {
                            error: "InvalidRequest".to_string(),
                            message: Some("Blob not found".to_string()),
                        },
                        status: StatusCode::BAD_REQUEST,
                    };
                };
                tracing::error!(%e, "failed to get object");
                XrpcErrorResponse::internal_server_error()
            }
            _ => {
                tracing::error!(%e, "failed to get object");
                XrpcErrorResponse::internal_server_error()
            }
        };
    })?;

    let s3_request_headers = s3_obj.headers();
    let content_type = match s3_request_headers.get("content-type") {
        None => &"application/octet-stream".to_string(),
        Some(content_type) => content_type,
    };

    // Build an AsyncRead over in-memory bytes and convert to Tokio AsyncRead
    let data = s3_obj.bytes().to_vec();
    let fut_cursor = futures::io::Cursor::new(data);
    let reader = fut_cursor.compat();

    // Wrap the AsyncRead in a BufReader to satisfy AsyncBufRead for the decoder
    let buf_reader = BufReader::new(reader);

    // Zstd decode the stream on-the-fly
    let decoder = ZstdDecoder::new(buf_reader);

    // Convert the AsyncRead decoder into a Stream of Bytes for Axum Body
    let decoded_stream = ReaderStream::new(decoder);
    let body = Body::from_stream(decoded_stream);

    let response = Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .map_err(|_| XrpcErrorResponse::internal_server_error())?;

    Ok(response)
}

#[axum_macros::debug_handler]
async fn list_blobs(
    State(state): State<AppState>,
    ExtractXrpc(args): ExtractXrpc<ListBlobsRequest>,
) -> Result<
    axum::Json<lexicon_types_crate::com_atproto::sync::list_blobs::ListBlobsOutput<'static>>,
    XrpcErrorResponse,
> {
    //Since is not supported sadly since we do not record individual records and keep track of those tids
    let did = args.did.to_string();
    let limit = args.limit.unwrap_or(500).min(1000).max(1);
    let cursor = args.cursor.as_ref().map(|c| c.as_ref());

    // Check if account exists
    let account_exists = state
        .db
        .is_user_already_registered(&did)
        .await
        .map_err(|e| {
            tracing::error!(%e, "failed to check if user exists");
            XrpcErrorResponse::internal_server_error()
        })?;

    if !account_exists {
        return Err(XrpcErrorResponse {
            error: XrpcError {
                error: "RepoNotFound".to_string(),
                message: Some(format!("Could not find repo for DID: {did}")),
            },
            status: StatusCode::NOT_FOUND,
        });
    }

    // Fetch blobs from database
    let (cids, next_cursor) = state
        .db
        .list_blobs(&did, cursor, limit)
        .await
        .map_err(|e| {
            tracing::error!(%e, "failed to list blobs");
            XrpcErrorResponse::internal_server_error()
        })?;

    // Convert to the response type
    use lexicon_types_crate::com_atproto::sync::list_blobs::ListBlobsOutput;

    // Parse and validate CIDs, converting them to owned 'static lifetimes
    let parsed_cids: Result<Vec<jacquard_common::types::string::Cid<'static>>, XrpcErrorResponse> =
        cids.into_iter()
            .map(|cid| {
                // Validate CID format
                jacquard_common::types::string::Cid::new(cid.as_bytes()).map_err(|e| {
                    tracing::error!(%e, cid = %cid, "failed to parse CID");
                    XrpcErrorResponse::internal_server_error()
                })?;
                // Convert to owned/static by parsing the validated string
                Ok(jacquard_common::types::string::Cid::new(
                    cid.into_bytes().leak() as &'static [u8]
                )
                .expect("already validated"))
            })
            .collect();

    let output = ListBlobsOutput {
        cids: parsed_cids?,
        cursor: next_cursor.map(|c| c.into()),
        extra_data: Default::default(),
    };

    Ok(axum::Json(output))
}

pub fn atproto_routes(_state: AppState) -> Router<AppState> {
    Router::new()
        .merge(GetRepoRequest::into_router(get_repo))
        .merge(GetBlobRequest::into_router(get_blob))
        .merge(ListBlobsRequest::into_router(list_blobs))
}
