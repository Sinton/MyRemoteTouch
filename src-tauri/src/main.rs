// Prevents additional console window on Windows in release, do not remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::Manager;
mod ios_proxy;
mod wda_client;
mod video_stream;
pub mod error;

use crate::error::AppResult;
use crate::wda_client::{WdaClient, WdaResponse};
use tokio_util::sync::CancellationToken;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TouchPoint {
    pub x: u32,
    pub y: u32,
    pub time: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

const WDA_URL: &str = "http://127.0.0.1:8100";

// 1. 获取窗口尺寸
#[tauri::command]
async fn get_window_size(wda: tauri::State<'_, WdaClient>) -> AppResult<WindowSize> {
    println!("正在获取设备分辨率...");
    let url = wda.format_url("/window/size");
    let res = wda.get_client().get(&url).send().await?;
    let body = res.json::<WdaResponse<WindowSize>>().await?;
    println!("同步到设备分辨率: {}x{}", body.value.width, body.value.height);
    Ok(body.value)
}

#[tauri::command]
async fn send_touch_actions(wda: tauri::State<'_, WdaClient>, actions: Vec<TouchPoint>) -> AppResult<()> {
    if actions.is_empty() { return Ok(()); }
    let sid = wda.get_session_id().await;
    let mut pointer_actions = Vec::new();
    
    let start = &actions[0];
    pointer_actions.push(json!({ "type": "pointerMove", "duration": 0, "x": start.x, "y": start.y }));
    pointer_actions.push(json!({ "type": "pointerDown", "button": 0 }));
    
    let mut last_time = start.time;
    for i in 1..actions.len() {
        let point = &actions[i];
        let mut duration = point.time.saturating_sub(last_time);
        if duration > 500 { duration = 500; }
        pointer_actions.push(json!({ "type": "pointerMove", "duration": duration, "x": point.x, "y": point.y }));
        last_time = point.time;
    }
    pointer_actions.push(json!({ "type": "pointerUp", "button": 0 }));
    
    let w3c_body = json!({
        "actions": [{
            "type": "pointer",
            "id": "finger1",
            "parameters": { "pointerType": "touch" },
            "actions": pointer_actions
        }]
    });
    
    let url = wda.format_url(&format!("/session/{}/actions", sid));
    wda.get_client().post(&url).json(&w3c_body).send().await?;
    Ok(())
}

#[tauri::command]
async fn send_tap(wda: tauri::State<'_, WdaClient>, x: u32, y: u32) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let w3c_body = json!({
        "actions": [{
            "type": "pointer",
            "id": "finger1",
            "parameters": { "pointerType": "touch" },
            "actions": [
                { "type": "pointerMove", "duration": 0, "x": x, "y": y },
                { "type": "pointerDown", "button": 0 },
                { "type": "pause", "duration": 50 },
                { "type": "pointerUp", "button": 0 }
            ]
        }]
    });
    
    let url_actions = wda.format_url(&format!("/session/{}/actions", sid));
    wda.get_client().post(&url_actions).json(&w3c_body).send().await?;
    Ok(())
}

#[tauri::command]
async fn send_keys(wda: tauri::State<'_, WdaClient>, key: String) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/keys", sid));
    wda.get_client().post(url).json(&json!({ "value": [key] })).send().await?;
    Ok(())
}

#[tauri::command]
async fn press_volume_up(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/pressButton", sid));
    wda.get_client().post(url).json(&json!({ "name": "volumeup" })).send().await?;
    Ok(())
}

#[tauri::command]
async fn press_volume_down(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/pressButton", sid));
    wda.get_client().post(url).json(&json!({ "name": "volumedown" })).send().await?;
    Ok(())
}

#[tauri::command]
async fn toggle_lock(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    let res = wda.get_client().post(format!("{}/session/{}/wda/lock", base_url, sid)).send().await;
    let mut success = false;
    if let Ok(r) = res {
        if r.status().is_success() { success = true; }
    }
    if !success {
        wda.get_client().post(format!("{}/session/{}/wda/pressButton", base_url, sid))
            .json(&json!({ "name": "power" })).send().await?;
    }
    Ok(())
}

#[tauri::command]
async fn press_home_button(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    let _ = wda.get_client().post(format!("{}/wda/homescreen", base_url)).send().await;
    wda.get_client().post(format!("{}/session/{}/wda/pressButton", base_url, sid))
        .json(&json!({ "name": "home" })).send().await?;
    Ok(())
}

#[tauri::command]
async fn press_mute_button(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    for key_name in &["muteswitch", "mute", "muteswitchtoggle"] {
        let res = wda.get_client().post(format!("{}/session/{}/wda/pressButton", base_url, sid))
            .json(&json!({ "name": key_name }))
            .send()
            .await;
        if let Ok(r) = res {
            if r.status().is_success() { break; }
        }
    }
    Ok(())
}

fn main() {
    let cancel_token = CancellationToken::new();
    let app_token = cancel_token.clone();

    tauri::Builder::default()
        .manage(WdaClient::new(WDA_URL))
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let handle = app.handle().clone();
            let token = app_token.clone();
            
            ios_proxy::init_proxies(handle.clone());
            
            let video_token = token.clone();
            tauri::async_runtime::spawn(async move {
                video_stream::start_video_server(9999, 9100, video_token).await;
            });

            let heartbeat_token = token.clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(10));
                loop {
                    tokio::select! {
                        _ = heartbeat_token.cancelled() => break,
                        _ = interval.tick() => {
                            let wda_state = handle.state::<WdaClient>();
                            if !wda_state.check_health().await {
                                eprintln!(">>> [Heartbeat] WDA 连接异常");
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(move |_, event| {
            if let tauri::WindowEvent::Destroyed = event {
                cancel_token.cancel();
                println!(">>> [Main] 正在停机并清理资源...");
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_window_size,
            send_tap,
            send_touch_actions,
            send_keys,
            press_home_button,
            press_mute_button,
            press_volume_up,
            press_volume_down,
            toggle_lock
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
