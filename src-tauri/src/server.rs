use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tower_http::cors::{Any, CorsLayer};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StartPayload {
    pub prompt: Option<String>,
    pub model: Option<String>,
    pub estimated_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StopPayload {
    pub success: Option<bool>,
    pub summary: Option<String>,
    pub auto_timeout: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

#[derive(Clone)]
pub struct ServerState {
    pub app_handle: AppHandle,
    pub timeout_handle: Arc<Mutex<Option<tokio::task::AbortHandle>>>,
}

pub async fn start_server(app_handle: AppHandle) {
    let state = ServerState {
        app_handle,
        timeout_handle: Arc::new(Mutex::new(None)),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/status", get(health_check))
        .route("/start", post(handle_start))
        .route("/stop", post(handle_stop))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 9999));
    println!("[WaitMate Webhook] Démarrage du serveur HTTP sur http://{}", addr);

    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[WaitMate Webhook] Erreur d'exécution du serveur : {}", e);
            }
        }
        Err(e) => {
            eprintln!("[WaitMate Webhook] Impossible de lier le port 9999 : {}. Un autre processus écoute-t-il ?", e);
        }
    }
}

async fn health_check() -> impl IntoResponse {
    Json(ApiResponse {
        success: true,
        message: "WaitMate Webhook Server is running".to_string(),
        data: Some(serde_json::json!({
            "version": "0.1.0",
            "port": 9999,
            "endpoints": ["/start", "/stop", "/status", "/health"]
        })),
    })
}

async fn handle_start(
    State(state): State<ServerState>,
    payload: Option<Json<StartPayload>>,
) -> (StatusCode, Json<ApiResponse<StartPayload>>) {
    let data = payload.map(|Json(p)| p).unwrap_or_default();
    println!("[WaitMate Webhook] Reçu POST /start : {:?}", data);

    // Émettre l'événement Tauri au frontend
    if let Err(e) = state.app_handle.emit("start-ai", &data) {
        eprintln!("[WaitMate Webhook] Erreur lors de l'émission de start-ai : {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                message: format!("Failed to emit start-ai event: {}", e),
                data: None,
            }),
        );
    }

    // Annuler tout timeout existant
    let mut guard = state.timeout_handle.lock().unwrap();
    if let Some(handle) = guard.take() {
        handle.abort();
    }

    // Démarrer un safety timeout automatique (60s par défaut ou estimated_time)
    let timeout_duration = data.estimated_time.unwrap_or(60);
    let app_handle_clone = state.app_handle.clone();
    let timeout_task = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(timeout_duration)).await;
        println!("[WaitMate Webhook] Safety timeout atteint ({}s) - auto-stop émis", timeout_duration);
        let _ = app_handle_clone.emit(
            "stop-ai",
            &StopPayload {
                success: Some(true),
                summary: Some("Temps limite de génération automatique atteint".to_string()),
                auto_timeout: Some(true),
            },
        );
    });

    *guard = Some(timeout_task.abort_handle());

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            message: "AI session started. Mini-game activated.".to_string(),
            data: Some(data),
        }),
    )
}

async fn handle_stop(
    State(state): State<ServerState>,
    payload: Option<Json<StopPayload>>,
) -> (StatusCode, Json<ApiResponse<StopPayload>>) {
    let data = payload.map(|Json(p)| p).unwrap_or_default();
    println!("[WaitMate Webhook] Reçu POST /stop : {:?}", data);

    // Annuler le safety timeout
    let mut guard = state.timeout_handle.lock().unwrap();
    if let Some(handle) = guard.take() {
        handle.abort();
    }

    // Émettre l'événement Tauri au frontend
    if let Err(e) = state.app_handle.emit("stop-ai", &data) {
        eprintln!("[WaitMate Webhook] Erreur lors de l'émission de stop-ai : {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                message: format!("Failed to emit stop-ai event: {}", e),
                data: None,
            }),
        );
    }

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            message: "AI session stopped. Returning to idle mode.".to_string(),
            data: Some(data),
        }),
    )
}
