// Prevents additional console window on Windows in release, do not remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Serialize, Deserialize)]
pub struct WindowSize {
    width: u32,
    height: u32,
}

const WDA_URL: &str = "http://localhost:8100";

// 1. 获取窗口尺寸
#[tauri::command]
async fn get_window_size() -> Result<WindowSize, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/window/size", WDA_URL))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let width = json["value"]["width"].as_u64().unwrap_or(390) as u32;
    let height = json["value"]["height"].as_u64().unwrap_or(844) as u32;

    Ok(WindowSize { width, height })
}

// 2. 发送点击事件
#[tauri::command]
async fn send_tap(x: u32, y: u32) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = json!({
        "x": x,
        "y": y
    });

    client
        .post(format!("{}/wda/tap/0", WDA_URL))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// 3. 发送滑动事件
#[tauri::command]
async fn send_swipe(from_x: u32, from_y: u32, to_x: u32, to_y: u32) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = json!({
        "fromX": from_x,
        "fromY": from_y,
        "toX": to_x,
        "toY": to_y,
        "duration": 0.2
    });

    client
        .post(format!("{}/wda/dragfromtoforduration", WDA_URL))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// 4. 发送按键输入
#[tauri::command]
async fn send_keys(key: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = json!({
        "value": [key]
    });

    client
        .post(format!("{}/wda/keys", WDA_URL))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_window_size,
            send_tap,
            send_swipe,
            send_keys
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
