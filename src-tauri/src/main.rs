// Prevents additional console window on Windows in release, do not remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::OnceLock;
use std::sync::Mutex;
use std::time::Instant;

static SESSION_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(Serialize, Deserialize)]
pub struct WindowSize {
    width: u32,
    height: u32,
}

const WDA_URL: &str = "http://127.0.0.1:8100";

fn get_cache() -> &'static Mutex<Option<String>> {
    SESSION_CACHE.get_or_init(|| Mutex::new(None))
}

fn get_client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3)) // 缩短超时
            .tcp_nodelay(true) // 关键：禁用 Nagle 算法，减少报文延迟
            .pool_idle_timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap()
    })
}

// 极致调优：在获取 Session 后必须调用
async fn set_wda_settings(sid: &str) {
    let client = get_client();
    let settings = json!({
        "settings": {
            "waitForQuiescence": false,
            "waitForIdle": false,
            "animationCoolOffTimeout": 0,
            "shouldUseCompactResponses": true,
            "elementResponseAttributes": "type,label"
        }
    });
    match client.post(format!("{}/session/{}/appium/settings", WDA_URL, sid))
        .json(&settings).send().await {
        Ok(res) => println!(">>> [Settings] 应用成功: {}", res.status()),
        Err(e) => println!(">>> [Settings] 应用失败: {}", e),
    }
}

// 1. 获取窗口尺寸
#[tauri::command]
async fn get_window_size() -> Result<WindowSize, String> {
    println!("正在获取设备分辨率...");
    let client = get_client(); // Use shared client
    let res = client
        .get(format!("{}/window/size", WDA_URL))
        .send()
        .await
        .map_err(|e| {
            println!("获取分辨率失败: {}", e);
            e.to_string()
        })?;

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let width = json["value"]["width"].as_u64().unwrap_or(390) as u32;
    let height = json["value"]["height"].as_u64().unwrap_or(844) as u32;

    println!("同步到设备分辨率: {}x{}", width, height);
    Ok(WindowSize { width, height })
}

// 持久 Session ID 获取器 (带同步极速设置)
async fn get_stable_sid() -> String {
    let cache = get_cache();
    {
        let lock = cache.lock().unwrap();
        if let Some(id) = &*lock { return id.clone(); }
    }

    let client = get_client();
    
    // 1. 探测现有 Session
    if let Ok(res) = client.get(format!("{}/status", WDA_URL)).send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            let sid = json["sessionId"].as_str()
                .or_else(|| json["value"]["sessionId"].as_str())
                .map(|s| s.to_string());
            if let Some(id) = sid {
                if !id.is_empty() && id != "null" {
                    {
                        let mut lock = cache.lock().unwrap();
                        *lock = Some(id.clone());
                    }
                    set_wda_settings(&id).await; // 必须等待配置生效！
                    return id;
                }
            }
        }
    }

    // 2. 创建极速 Session
    println!(">>> 正在重建物理 Session (极速模式)...");
    let caps = json!({ "capabilities": { "alwaysMatch": {} } });
    if let Ok(res) = client.post(format!("{}/session", WDA_URL)).json(&caps).send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            let sid = json["sessionId"].as_str()
                .or_else(|| json["value"]["sessionId"].as_str())
                .map(|s| s.to_string());
            if let Some(id) = sid {
                {
                    let mut lock = cache.lock().unwrap();
                    *lock = Some(id.clone());
                }
                set_wda_settings(&id).await; // 必须等待配置生效！
                return id;
            }
        }
    }

    "any".to_string()
}

// 极速版补齐：针对不同版本的 WDA 进行端点自动兼容
#[tauri::command]
async fn send_tap(x: u32, y: u32) -> Result<(), String> {
    tokio::spawn(async move {
        let sid = get_stable_sid().await;
        let body = json!({ "x": x, "y": y });
        let client = get_client();
        let url = format!("{}/session/{}/wda/tap/0", WDA_URL, sid);
        let _ = client.post(&url).json(&body).send().await;
    });
    Ok(())
}

#[tauri::command]
async fn send_swipe(from_x: u32, from_y: u32, to_x: u32, to_y: u32) -> Result<(), String> {
    tokio::spawn(async move {
        let sid = get_stable_sid().await;
        let body = json!({
            "fromX": from_x, "fromY": from_y, "toX": to_x, "toY": to_y, "duration": 0.01
        });
        let _ = get_client().post(format!("{}/session/{}/wda/dragfromtoforduration", WDA_URL, sid))
            .json(&body)
            .send().await;
    });
    Ok(())
}

#[tauri::command]
async fn send_keys(key: String) -> Result<(), String> {
    tokio::spawn(async move {
        let sid = get_stable_sid().await;
        let body = json!({ "value": [key] });
        let _ = get_client().post(format!("{}/session/{}/wda/keys", WDA_URL, sid)).json(&body).send().await;
    });
    Ok(())
}

#[tauri::command]
async fn press_volume_up() -> Result<(), String> {
    tokio::spawn(async move {
        let sid = get_stable_sid().await;
        let body = json!({ "name": "volumeup" });
        let _ = get_client().post(format!("{}/session/{}/wda/pressButton", WDA_URL, sid))
            .json(&body).send().await;
    });
    Ok(())
}

#[tauri::command]
async fn press_volume_down() -> Result<(), String> {
    tokio::spawn(async move {
        let sid = get_stable_sid().await;
        let body = json!({ "name": "volumedown" });
        let _ = get_client().post(format!("{}/session/{}/wda/pressButton", WDA_URL, sid))
            .json(&body).send().await;
    });
    Ok(())
}

#[tauri::command]
async fn toggle_lock() -> Result<(), String> {
    tokio::spawn(async move {
        let sid = get_stable_sid().await;
        let client = get_client();
        // 方案 A: 尝试 WDA 标准锁定接口
        let res = client.post(format!("{}/session/{}/wda/lock", WDA_URL, sid)).send().await;
        if res.is_err() || !res.unwrap().status().is_success() {
            // 方案 B: 模拟电源键按压 (部分 WDA 更加支持这个来熄屏)
            let _ = client.post(format!("{}/session/{}/wda/pressButton", WDA_URL, sid))
                .json(&json!({ "name": "power" })).send().await;
        }
    });
    Ok(())
}

#[tauri::command]
async fn press_home_button() -> Result<(), String> {
    tokio::spawn(async move {
        let client = get_client();
        // 方案 A: 全局直连 (最快)
        let _ = client.post(format!("{}/wda/homescreen", WDA_URL)).send().await;
        // 方案 B: 带 Session 的物理模拟 (备选)
        let sid = get_stable_sid().await;
        let _ = client.post(format!("{}/session/{}/wda/pressButton", WDA_URL, sid))
            .json(&json!({ "name": "home" })).send().await;
    });
    Ok(())
}

#[tauri::command]
async fn press_mute_button() -> Result<(), String> {
    tokio::spawn(async move {
        let sid = get_stable_sid().await;
        let client = get_client();
        // 尝试不同的静音键别名，因为 WDA 不同版本命名不一
        for key_name in &["muteswitch", "mute", "muteswitchtoggle"] {
            let res = client.post(format!("{}/session/{}/wda/pressButton", WDA_URL, sid))
                .json(&json!({ "name": key_name }))
                .send()
                .await;
            if let Ok(r) = res {
                if r.status().is_success() { break; }
            }
        }
    });
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_window_size,
            send_tap,
            send_swipe,
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
