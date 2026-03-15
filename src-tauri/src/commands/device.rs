use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::error::AppResult;
use crate::wda_client::{WdaClient, WdaResponse};

#[derive(Serialize, Deserialize, Debug)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn get_window_size(wda: tauri::State<'_, WdaClient>) -> AppResult<WindowSize> {
    println!("正在获取设备分辨率...");
    let url = wda.format_url("/window/size");
    let res = wda.get_client().get(&url).send().await?;
    let body = res.json::<WdaResponse<WindowSize>>().await?;
    println!("同步到设备分辨率: {}x{}", body.value.width, body.value.height);
    Ok(body.value)
}

#[tauri::command]
pub async fn update_video_settings(wda: tauri::State<'_, WdaClient>, quality: u8, framerate: u8) -> AppResult<()> {
    println!(">>> [WDA] 更新视频画质设置: Quality={}, Framerate={}", quality, framerate);
    crate::video::config::set_video_fps(framerate as u32);
    wda.update_settings(quality, framerate).await
}

#[tauri::command]
pub async fn update_video_settings_with_scale(
    wda: tauri::State<'_, WdaClient>, 
    quality: u8, 
    framerate: u8,
    scale: f32
) -> AppResult<()> {
    println!(">>> [WDA] 更新视频设置: Quality={}, Framerate={}, Scale={}%", 
        quality, framerate, (scale * 100.0) as u8);
    crate::video::config::set_video_fps(framerate as u32);
    wda.update_settings_with_scale(quality, framerate, scale).await
}

#[tauri::command]
pub async fn set_video_active(state: tauri::State<'_, Arc<crate::video::StreamingState>>, active: bool) -> AppResult<()> {
    println!(">>> [Video] 设置后台抓流状态: {}", if active { "激活" } else { "停止" });
    state.enabled.store(active, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn get_wda_settings(wda: tauri::State<'_, WdaClient>) -> AppResult<serde_json::Value> {
    println!(">>> [Debug] 获取当前 WDA 设置...");
    let settings = wda.get_current_settings().await?;
    println!(">>> [Debug] 当前设置: {}", serde_json::to_string_pretty(&settings).unwrap_or_default());
    Ok(settings)
}
