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
        quality, framerate, scale as u8);
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

#[tauri::command]
pub async fn set_orientation(wda: tauri::State<'_, Arc<WdaClient>>, orientation: String) -> AppResult<()> {
    info!("设置设备屏幕方向: {}", orientation);
    let url = wda.format_url("/orientation");
    
    // WDA expects {"orientation": "LANDSCAPE"} or {"orientation": "PORTRAIT"}
    let response = wda.get_client()
        .post(url)
        .json(&serde_json::json!({ "orientation": orientation.to_uppercase() }))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
        return Err(crate::error::AppError::Wda(
            format!("设置方向失败: 状态码 {}, 响应: {}", status, error_text)
        ));
    }
    
    info!("设备屏幕方向设置成功: {}", orientation);
    Ok(())
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

#[tauri::command]
pub async fn find_element(
    wda: tauri::State<'_, Arc<WdaClient>>, 
    strategy: String,
    selector: String
) -> AppResult<String> {
    info!("正在查找元素: Strategy={}, Selector='{}'", strategy, selector);
    wda.find_element(&strategy, &selector).await
}

#[tauri::command]
pub async fn find_element_by_label(
    wda: tauri::State<'_, Arc<WdaClient>>, 
    label: String
) -> AppResult<String> {
    info!("正在通过 Label 查找元素: '{}'", label);
    wda.find_element_by_label(&label).await
}

#[tauri::command]
pub async fn get_element_rect(
    wda: tauri::State<'_, Arc<WdaClient>>, 
    element_id: String
) -> AppResult<serde_json::Value> {
    debug!("正在获取元素 {} 的位置...", element_id);
    wda.get_element_rect(&element_id).await
}

#[tauri::command]
pub async fn get_ui_source(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<serde_json::Value> {
    info!("🚀 开始远程抓取全量界面树 (JSON)...");
    let now = std::time::Instant::now();
    let res = wda.get_source().await;
    let elapsed = now.elapsed().as_secs_f32();
    match &res {
        Ok(_) => info!("✅ 界面树 (JSON) 抓取成功，耗时: {:.2}s", elapsed),
        Err(e) => info!("❌ 界面树 (JSON) 抓取失败，耗时: {:.2}s, 错误: {}", elapsed, e),
    }
    res
}

#[tauri::command]
pub async fn get_ui_source_xml(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<String> {
    info!("🚀 开始远程抓取全量界面树 (XML Hierarchy)...");
    let now = std::time::Instant::now();
    let res = wda.get_source_xml().await;
    let elapsed = now.elapsed().as_secs_f32();
    match &res {
        Ok(_) => info!("✅ 界面树 (XML) 抓取成功，耗时: {:.2}s", elapsed),
        Err(e) => info!("❌ 界面树 (XML) 抓取失败，耗时: {:.2}s, 错误: {}", elapsed, e),
    }
    res
}

#[tauri::command]
pub async fn optimize_wda_performance(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<()> {
    info!("🚀 执行 WDA 性能优化补丁...");
    let sid = wda.get_session_id().await;
    wda.apply_low_latency_settings(&sid).await
}

