use crate::AppState;
use atproto_identity::key::{identify_key, validate};
use axum::Json;
use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use jacquard_common::types::did::Did;
use jacquard_common::url::Url;
use jacquard_identity::PublicResolver;
use jacquard_identity::resolver::IdentityResolver;
use jwt_compact::{Claims, UntrustedToken};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub mod com_atproto_sync;
pub mod com_pdsmoover_admin_handlers;
pub mod com_pdsmoover_backup_handlers;

pub struct XrpcErrorResponse {
    error: XrpcError,
    pub status: StatusCode,
}

impl XrpcErrorResponse {
    pub fn internal_server_error() -> Self {
        Self {
            error: XrpcError {
                error: "InternalServerError".to_string(),
                message: None,
            },
            status: StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn auth_missing() -> Self {
        Self {
            error: XrpcError {
                error: "AuthMissing".to_string(),
                message: Some("Authentication Required".to_string()),
            },
            status: StatusCode::UNAUTHORIZED,
        }
    }

    pub fn invalid_token(_message: Option<&str>) -> Self {
        Self {
            error: XrpcError {
                error: "InvalidToken".to_string(),
                message: None,
            },
            status: StatusCode::UNAUTHORIZED,
        }
    }
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct XrpcError {
    pub error: String,
    #[serde(skip_serializing_if = "std::option::Option::is_none")]
    pub message: Option<String>,
}

impl IntoResponse for XrpcErrorResponse {
    fn into_response(self) -> Response {
        (self.status, Json(self.error)).into_response()
    }
}

/// Subset of data returned that has been validated of the user making the call
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct VerifiedServiceAuthResults {
    /// The user's did
    pub did: String,
    /// The user's pds url
    pub pds_url: Url,
    /// The user's atproto multikey used to verify requests and signing
    pub multi_key: String,
}

/// A subset of the claims that are in the service auth token.
#[derive(Serialize, Deserialize)]
struct ServiceAuthClaims {
    /// User's did
    pub iss: String,
    /// Audience (did:web in this case that was proxied)
    pub aud: String,
    /// Lexicon XRPC endpoint requested. example com.atproto.sync.getRecord
    pub lxm: String,
}

/// Verifies the service auth token that is appended to an XRPC proxy request
async fn verify_service_auth(
    jwt: String,
    lxm: &str,
    public_resolver: Arc<PublicResolver>,
    did_web: String,
) -> anyhow::Result<VerifiedServiceAuthResults> {
    let token = UntrustedToken::new(&jwt)?;

    let claims: Claims<ServiceAuthClaims> = token.deserialize_claims_unchecked()?;
    let did = Did::new(claims.custom.iss.as_str())?;
    let doc_response = public_resolver.resolve_did_doc(&did).await?;
    let doc = doc_response.parse()?;

    let multi_key = match doc.atproto_multikey() {
        Some(key) => key,
        None => {
            return Err(anyhow::anyhow!("No atproto_multikey in did doc"));
        }
    };
    let identified_key = identify_key(&multi_key)?;

    // If no error is throw it's valid. Should check expiry time here as well (I think)
    let _ = validate(
        &identified_key,
        &token.signature_bytes(),
        &token.signed_data,
    )?;

    if claims.custom.aud != did_web {
        return Err(anyhow::anyhow!("Invalid audience (did:web)"));
    }

    if claims.custom.lxm != lxm {
        return Err(anyhow::anyhow!("Invalid XRPC endpoint requested"));
    }
    let pds_url = match doc.pds_endpoint() {
        None => {
            return Err(anyhow::anyhow!("No pds_endpoint in did doc"));
        }
        Some(endpoint) => endpoint,
    };

    Ok(VerifiedServiceAuthResults {
        did: did.to_string(),
        pds_url,
        multi_key: multi_key.to_string(),
    })
}

async fn service_auth_middleware(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, XrpcErrorResponse> {
    // Expect Authorization: Bearer <jwt>
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    let Some(value) = auth_header else {
        return Err(XrpcErrorResponse::auth_missing());
    };

    // Ensure Bearer prefix
    let token = value.strip_prefix("Bearer ").unwrap_or("").trim();
    if token.is_empty() {
        return Err(XrpcErrorResponse::auth_missing());
    }

    // Build lxm from request path by removing /xrpc/ prefix
    let path = req.uri().path();
    let lxm = path.strip_prefix("/xrpc/").unwrap_or(path);

    // Verify token
    let verified = verify_service_auth(
        token.to_string(),
        lxm,
        state.public_resolver.clone(),
        state.did_web.0.clone(),
    )
    .await;

    match verified {
        Ok(results) => {
            req.extensions_mut().insert(results);
            Ok(next.run(req).await)
        }
        Err(err) => {
            tracing::warn!(error = %err, "Invalid service auth token");
            Err(XrpcErrorResponse::invalid_token(None))
        }
    }
}

// Admin Basic auth middleware
// Expects Authorization: Basic base64("admin:<ADMIN_TOKEN>")
async fn admin_basic_auth_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, XrpcErrorResponse> {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD as BASE64;

    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    let Some(value) = auth_header else {
        return Err(XrpcErrorResponse::auth_missing());
    };

    let encoded = value.strip_prefix("Basic ").unwrap_or("").trim();
    if encoded.is_empty() {
        return Err(XrpcErrorResponse::auth_missing());
    }

    let decoded_bytes = match BASE64.decode(encoded.as_bytes()) {
        Ok(bytes) => bytes,
        Err(_) => return Err(XrpcErrorResponse::invalid_token(None)),
    };

    let decoded = match String::from_utf8(decoded_bytes) {
        Ok(s) => s,
        Err(_) => return Err(XrpcErrorResponse::invalid_token(None)),
    };

    let Some((user, token)) = decoded.split_once(':') else {
        return Err(XrpcErrorResponse::invalid_token(None));
    };

    match state.admin_token.as_deref() {
        Some(expected) if user == "admin" && token == expected => Ok(next.run(req).await),
        _ => Err(XrpcErrorResponse::invalid_token(None)),
    }
}
