//! WebSocket endpoints for live frontend updates.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::Response,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{fmt::Display, time::Duration};
use tokio::time::{Instant, MissedTickBehavior};

use crate::{
    dbus::{
        get_airplane_mode, get_data_connection_status, get_device_info_data, get_ims_status,
        get_network_info_data, get_qos_info_data, get_roaming_status, get_sim_info_data,
    },
    handlers::{collect_cells, collect_connectivity_check, collect_system_stats},
    models::{
        AirplaneModeResponse, CellsResponse, ConnectivityCheckResponse, DeviceInfoResponse,
        ImsStatusResponse, NetworkInfoResponse, QosInfoResponse, RoamingResponse, SimInfoResponse,
        SystemStatsResponse,
    },
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct DashboardWsQuery {
    interval: Option<u64>,
}

impl DashboardWsQuery {
    fn interval_ms(&self) -> u64 {
        self.interval.unwrap_or(3000).clamp(1000, 60_000)
    }
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSnapshot {
    #[serde(skip_serializing_if = "Option::is_none")]
    device_info: Option<DeviceInfoResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sim_info: Option<SimInfoResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system_stats: Option<SystemStatsResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    network_info: Option<NetworkInfoResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data_status: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cells_info: Option<CellsResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    qos_info: Option<QosInfoResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    airplane_mode: Option<AirplaneModeResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ims_status: Option<ImsStatusResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    connectivity: Option<ConnectivityCheckResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    roaming: Option<RoamingResponse>,
}

#[derive(Debug, Serialize)]
struct DashboardWsPayload {
    #[serde(rename = "type")]
    message_type: &'static str,
    timestamp: String,
    data: DashboardSnapshot,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    errors: Vec<String>,
}

#[derive(Debug, Serialize)]
struct DashboardWsError {
    #[serde(rename = "type")]
    message_type: &'static str,
    timestamp: String,
    message: String,
}

pub async fn dashboard_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<DashboardWsQuery>,
) -> Response {
    ws.on_upgrade(move |socket| dashboard_ws(socket, state, query.interval_ms()))
}

async fn dashboard_ws(mut socket: WebSocket, state: AppState, interval_ms: u64) {
    let period = Duration::from_millis(interval_ms);
    let mut ticker = tokio::time::interval_at(Instant::now() + period, period);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);

    if !send_dashboard_snapshot(&mut socket, &state).await {
        return;
    }

    loop {
        tokio::select! {
            _ = ticker.tick() => {
                if !send_dashboard_snapshot(&mut socket, &state).await {
                    break;
                }
            }
            message = socket.recv() => {
                match message {
                    Some(Ok(Message::Text(text))) => {
                        if text.as_str().trim().eq_ignore_ascii_case("refresh")
                            && !send_dashboard_snapshot(&mut socket, &state).await {
                            break;
                        }
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

async fn send_dashboard_snapshot(socket: &mut WebSocket, state: &AppState) -> bool {
    let (data, errors) = collect_dashboard_snapshot(state).await;
    let payload = DashboardWsPayload {
        message_type: "dashboard",
        timestamp: Utc::now().to_rfc3339(),
        data,
        errors,
    };

    match serde_json::to_string(&payload) {
        Ok(text) => socket.send(Message::Text(text.into())).await.is_ok(),
        Err(err) => {
            send_ws_error(
                socket,
                format!("Failed to serialize dashboard snapshot: {err}"),
            )
            .await
        }
    }
}

async fn send_ws_error(socket: &mut WebSocket, message: String) -> bool {
    let payload = DashboardWsError {
        message_type: "error",
        timestamp: Utc::now().to_rfc3339(),
        message,
    };

    match serde_json::to_string(&payload) {
        Ok(text) => socket.send(Message::Text(text.into())).await.is_ok(),
        Err(_) => false,
    }
}

async fn collect_dashboard_snapshot(state: &AppState) -> (DashboardSnapshot, Vec<String>) {
    let stats_task = tokio::spawn(async { collect_system_stats().await });
    let connectivity_task = tokio::task::spawn_blocking(collect_connectivity_check);
    let mut snapshot = DashboardSnapshot::default();
    let mut errors = Vec::new();
    let conn = state.dbus_conn.as_ref();

    set_or_record(
        &mut snapshot.device_info,
        get_device_info_data(conn).await,
        "deviceInfo",
        &mut errors,
    );
    set_or_record(
        &mut snapshot.sim_info,
        get_sim_info_data(conn).await,
        "simInfo",
        &mut errors,
    );
    set_or_record(
        &mut snapshot.network_info,
        get_network_info_data(conn).await,
        "networkInfo",
        &mut errors,
    );

    match get_data_connection_status(conn).await {
        Ok(active) => snapshot.data_status = Some(active),
        Err(err) => push_error(&mut errors, "dataStatus", err),
    }

    set_or_record(
        &mut snapshot.cells_info,
        collect_cells(conn).await,
        "cellsInfo",
        &mut errors,
    );
    set_or_record(
        &mut snapshot.qos_info,
        get_qos_info_data(conn).await,
        "qosInfo",
        &mut errors,
    );
    set_or_record(
        &mut snapshot.airplane_mode,
        get_airplane_mode(conn).await,
        "airplaneMode",
        &mut errors,
    );
    set_or_record(
        &mut snapshot.ims_status,
        get_ims_status(conn).await,
        "imsStatus",
        &mut errors,
    );

    match get_roaming_status(conn).await {
        Ok((roaming_allowed, is_roaming)) => {
            snapshot.roaming = Some(RoamingResponse {
                roaming_allowed,
                is_roaming,
            });
        }
        Err(err) => push_error(&mut errors, "roaming", err),
    }

    match stats_task.await {
        Ok(Ok(stats)) => snapshot.system_stats = Some(stats),
        Ok(Err(err)) => push_error(&mut errors, "systemStats", err),
        Err(err) => push_error(&mut errors, "systemStats", err),
    }

    match connectivity_task.await {
        Ok(connectivity) => snapshot.connectivity = Some(connectivity),
        Err(err) => push_error(&mut errors, "connectivity", err),
    }

    (snapshot, errors)
}

fn set_or_record<T, E>(
    slot: &mut Option<T>,
    result: Result<T, E>,
    label: &str,
    errors: &mut Vec<String>,
) where
    E: Display,
{
    match result {
        Ok(data) => *slot = Some(data),
        Err(err) => push_error(errors, label, err),
    }
}

fn push_error(errors: &mut Vec<String>, label: &str, err: impl Display) {
    errors.push(format!("{label}: {err}"));
}
