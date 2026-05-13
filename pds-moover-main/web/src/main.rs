mod handlers;

use crate::handlers::well_known::{
    ServiceDID, ServiceDocument, ServiceKey, build_service_document, handle_wellknown_did_web,
};
use crate::handlers::xrpc::com_atproto_sync::atproto_routes;
use crate::handlers::xrpc::com_pdsmoover_admin_handlers::admin_routes;
use crate::handlers::xrpc::com_pdsmoover_backup_handlers::backup_routes;
use atproto_identity::key::to_public;
use axum::http::header;
use axum::{Router, routing::get};
use chrono::{DateTime, Utc};
use dotenvy::dotenv;
use jacquard_identity::PublicResolver;
use s3::creds::Credentials;
use s3::{Bucket, Region};
use shared::db::Db;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tower_governor::GovernorLayer;
use tower_governor::governor::GovernorConfigBuilder;
use tower_governor::key_extractor::SmartIpKeyExtractor;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
struct AppState {
    db: Db,
    public_resolver: Arc<PublicResolver>,
    service_document: ServiceDocument,
    did_web: ServiceDID,
    admin_token: Option<String>,
    s3_bucket: Arc<Box<s3::Bucket>>,
    describe_server_cache: Arc<RwLock<Option<(shared::db::DescribeServerRow, DateTime<Utc>)>>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables from .env if present
    let _ = dotenv();

    let _prod = std::env::var("PROD")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    // Initialize tracing subscriber with env filter (RUST_LOG) and pretty formatter
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().compact())
        .init();

    // Initialize DB
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set, e.g. postgres://user:pass@localhost:5432/dbname");
    let db = Db::connect(&database_url).await?;
    db.apply_migrations().await?;

    //did:web/atproto service setup
    let external_domain = env::var("EXTERNAL_DOMAIN")?;
    let service_key_string = env::var("SERVICE_KEY")?;
    let service_did = ServiceDID(format!("did:web:{}", external_domain));
    let service_key: ServiceKey = service_key_string.try_into()?;

    let public_service_key = to_public(&service_key.0)
        .map(|public_key_data| public_key_data.to_string())
        .expect("public service key");
    let service_document = build_service_document(&*external_domain, &public_service_key);

    let resolver = PublicResolver::default();

    // Admin token used for temporary admin Basic auth
    // If not set, admin endpoints will not be added to the router
    let admin_password = env::var("ADMIN_PASSWORD").ok();

    // S3 setup for serving backups
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

    let state = AppState {
        db,
        service_document,
        public_resolver: Arc::new(resolver),
        did_web: service_did,
        admin_token: admin_password.clone(),
        s3_bucket: Arc::new(bucket),
        describe_server_cache: Arc::new(RwLock::new(None)),
    };

    // Build Axum router
    let mut app = Router::new()
        .route("/", get(root_handler))
        //XRPC Routes
        .merge(backup_routes(state.clone()))
        .merge(atproto_routes(state.clone()))
        //Other routes
        .route("/.well-known/did.json", get(handle_wellknown_did_web));

    // Conditionally add admin endpoints only if ADMIN_PASSWORD is set
    if state.admin_token.is_some() {
        // Basic rate limiting for admin endpoints.
        // Adjust per_second/burst_size as needed.
        let governor_conf = GovernorConfigBuilder::default()
            .per_second(60)
            .burst_size(5)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("valid governor config");
        let limiter = governor_conf.limiter().clone();

        let interval = Duration::from_secs(60);
        // a separate background task to clean up
        std::thread::spawn(move || {
            loop {
                limiter.retain_recent();
                std::thread::sleep(interval);
            }
        });
        let governor_layer = GovernorLayer::new(Arc::new(governor_conf));

        app = app.merge(admin_routes(state.clone()).layer(governor_layer));
    }

    //CORS
    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_origin(Any)
        .allow_headers(Any);

    // Finalize with state
    let app = app.layer(cors).with_state(state);

    // Read PORT from env or default to 3000
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3000);
    let addr: SocketAddr = ([0, 0, 0, 0], port).into();

    info!(%addr, "starting web server");

    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn root_handler() -> impl axum::response::IntoResponse {
    let body = r"
.---. .---.  .--.
: .; :: .  :: .--'
:  _.': :: :`. `.
: :   : :; : _`, :
:_;   :___.'`.__.'


.-..-. .--.  .--.
: `' :: ,. :: ,. :
: .. :: :: :: :: :.-..-. .--. .--.
: :; :: :; :: :; :: `; :' '_.': ..'
:_;:_;`.__.'`.__.'`.__.'`.__.':_;

 ";

    let intro = "\n\nThis is a PDS MOOver xrpc service\n\nCode: https://tangled.sh/@baileytownsend.dev/pds-moover\n";

    let banner = format!("         {body}\n{intro}");

    (
        [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        banner,
    )
}
