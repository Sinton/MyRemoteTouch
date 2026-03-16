use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::error::AppResult;
use crate::clients::{WdaClient, WdaResponse};
use tracing::{info, debug};

#[derive(Serialize, Deserialize, Debug)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn get_window_size(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<WindowSize> {
    info!("正在获取设备分辨率...");
    let url = wda.format_url("/window/size");
    let res = wda.get_client().get(&url).send().await?;
    let body = res.json::<WdaResponse<WindowSize>>().await?;
    info!("设备分辨率: {}x{}", body.value.width, body.value.height);
    Ok(body.value)
}

#[tauri::command]
pub async fn update_video_settings(wda: tauri::State<'_, Arc<WdaClient>>, quality: u8, framerate: u8) -> AppResult<()> {
    info!("更新视频画质设置: Quality={}, Framerate={}", quality, framerate);
    crate::video::config::set_video_fps(framerate as u32);
    wda.update_settings(quality, framerate).await
}

#[tauri::command]
pub async fn update_video_settings_with_scale(
    wda: tauri::State<'_, Arc<WdaClient>>, 
    quality: u8, 
    framerate: u8,
    scale: f32
) -> AppResult<()> {
    info!("更新视频设置: Quality={}, Framerate={}, Scale={}%", 
        quality, framerate, (scale * 100.0) as u8);
    crate::video::config::set_video_fps(framerate as u32);
    wda.update_settings_with_scale(quality, framerate, scale).await
}

#[tauri::command]
pub async fn set_video_active(state: tauri::State<'_, Arc<crate::video::StreamingState>>, active: bool) -> AppResult<()> {
    info!("设置后台抓流状态: {}", if active { "激活" } else { "停止" });
    state.enabled.store(active, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn get_wda_settings(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<serde_json::Value> {
    debug!("获取当前 WDA 设置...");
    let settings = wda.get_current_settings().await?;
    debug!("当前设置: {}", serde_json::to_string_pretty(&settings).unwrap_or_default());
    Ok(settings)
}

#[derive(Serialize, Debug)]
pub struct WdaDiagnostics {
    pub wda_reachable: bool,
    pub session_id: String,
    pub session_valid: bool,
    pub error_message: Option<String>,
}

#[tauri::command]
pub async fn diagnose_wda_connection(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<WdaDiagnostics> {
    info!("开始 WDA 连接诊断...");
    
    // 测试 WDA 是否可达
    let wda_reachable = match wda.check_health().await {
        Ok(_) => {
            info!("WDA 服务可达");
            true
        }
        Err(e) => {
            info!("WDA 服务不可达: {}", e);
            return Ok(WdaDiagnostics {
                wda_reachable: false,
                session_id: "N/A".to_string(),
                session_valid: false,
                error_message: Some(format!("WDA 连接失败: {}", e)),
            });
        }
    };
    
    // 获取 Session ID
    let session_id = wda.get_session_id().await;
    info!("当前 Session ID: {}", session_id.as_str());
    
    // 测试 Session 是否有效（尝试获取窗口大小）
    let session_valid = match get_window_size(wda.clone()).await {
        Ok(size) => {
            info!("Session 有效，设备分辨率: {}x{}", size.width, size.height);
            true
        }
        Err(e) => {
            info!("Session 无效: {}", e);
            false
        }
    };
    
    let diagnostics = WdaDiagnostics {
        wda_reachable,
        session_id: session_id.to_string(),
        session_valid,
        error_message: if !session_valid {
            Some("Session 无效，可能需要重新创建".to_string())
        } else {
            None
        },
    };
    
    info!("诊断完成: {:?}", diagnostics);
    Ok(diagnostics)
}
