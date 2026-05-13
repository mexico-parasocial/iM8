//ty nick https://tangled.org/@smokesignal.events/smokesignal/blob/main/src/service.rs

use crate::AppState;
use atproto_identity::key::{KeyData, identify_key};
use axum::Json;
use axum::extract::State;
use axum::response::{IntoResponse, Response};

#[derive(Clone)]
pub struct ServiceDocument(pub serde_json::Value);

#[derive(Clone)]
pub struct ServiceDID(pub String);

#[derive(Clone)]
pub struct ServiceKey(pub KeyData);

impl TryFrom<String> for ServiceKey {
    type Error = anyhow::Error;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        identify_key(&value)
            .map(ServiceKey)
            .map_err(|err| err.into())
    }
}

pub fn build_service_document(external_base: &str, public_service_key: &str) -> ServiceDocument {
    ServiceDocument(serde_json::json!({
            "@context": vec!["https://www.w3.org/ns/did/v1","https://w3id.org/security/multikey/v1"],
            "id": format!("did:web:{external_base}"),
            "alsoKnownAs": [],
            "verificationMethod":[{
                "id": format!("did:web:{external_base}#atproto"),
                "type":"Multikey",
                "controller": format!("did:web:{external_base}"),
                "publicKeyMultibase": public_service_key
            }],
            "service":[
                {
                    "id": "#repo_backup",
                    "type": "RepoBackupService",
                    "serviceEndpoint": format!("https://{external_base}")
                }
            ]
        }
    ))
}

pub async fn handle_wellknown_did_web(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, Response> {
    Ok(Json(state.service_document.0))
}
