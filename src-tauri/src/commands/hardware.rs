use serde_json::json;
use crate::error::AppResult;
use crate::clients::WdaClient;
use std::sync::Arc;
use tracing::info;

#[tauri::command]
pub async fn press_volume_up(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<()> {
    info!("按下音量增加键");
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/pressButton", sid.as_str()));
    
    let response = wda.get_client()
        .post(url)
        .json(&json!({ "name": "volumeup" }))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
        return Err(crate::error::AppError::Wda(
            format!("音量增加失败: 状态码 {}, 响应: {}", status, error_text)
        ));
    }
    
    info!("音量增加成功");
    Ok(())
}

#[tauri::command]
pub async fn press_volume_down(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<()> {
    info!("按下音量减少键");
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/pressButton", sid.as_str()));
    
    let response = wda.get_client()
        .post(url)
        .json(&json!({ "name": "volumedown" }))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
        return Err(crate::error::AppError::Wda(
            format!("音量减少失败: 状态码 {}, 响应: {}", status, error_text)
        ));
    }
    
    info!("音量减少成功");
    Ok(())
}

#[tauri::command]
pub async fn toggle_lock(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<()> {
    info!("切换锁屏状态");
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    
    // 先检查当前锁屏状态
    let locked_url = format!("{}/wda/locked", base_url);
    
    let is_locked = match wda.get_client().get(&locked_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(body) = response.json::<serde_json::Value>().await {
                    body["value"].as_bool().unwrap_or(false)
                } else {
                    false
                }
            } else {
                false
            }
        }
        Err(_) => false,
    };
    
    // 根据当前状态切换
    let action_url = if is_locked {
        format!("{}/session/{}/wda/unlock", base_url, sid.as_str())
    } else {
        format!("{}/session/{}/wda/lock", base_url, sid.as_str())
    };
    
    info!("执行操作: {}", if is_locked { "解锁" } else { "锁定" });
    
    // 发送请求（必须包含空的 JSON 请求体）
    let response = wda.get_client()
        .post(&action_url)
        .json(&serde_json::json!({}))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
        return Err(crate::error::AppError::Wda(
            format!("锁屏切换失败: 状态码 {}, 响应: {}", status, error_text)
        ));
    }
    
    info!("锁屏切换成功");
    Ok(())
}

#[tauri::command]
pub async fn press_home_button(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<()> {
    info!("按下 Home 键");
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    
    // 先尝试 /wda/homescreen（不检查结果，因为可能失败但不影响）
    let _ = wda.get_client()
        .post(format!("{}/wda/homescreen", base_url))
        .send()
        .await;
    
    // 然后按 home 按钮
    let response = wda.get_client()
        .post(format!("{}/session/{}/wda/pressButton", base_url, sid.as_str()))
        .json(&json!({ "name": "home" }))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
        return Err(crate::error::AppError::Wda(
            format!("Home 键失败: 状态码 {}, 响应: {}", status, error_text)
        ));
    }
    
    info!("Home 键成功");
    Ok(())
}

#[tauri::command]
pub async fn press_mute_button(_wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<()> {
    // iOS 的静音开关是物理开关，不是按钮
    // XCTest 框架不支持通过软件控制静音开关
    // 
    // 注意：iPhone 15 Pro 及更新机型有 Action 按钮（可编程按钮）
    // 如果需要控制 Action 按钮，请使用 press_action_button 命令
    // 
    // 参考: XCUIDevice 只支持 home, volumeup, volumedown, action, camera 按钮
    Err(crate::error::AppError::Wda(
        "iOS 静音开关是物理开关，无法通过软件控制。iPhone 15 Pro+ 可使用 Action 按钮".to_string()
    ))
}

#[tauri::command]
pub async fn press_action_button(wda: tauri::State<'_, Arc<WdaClient>>) -> AppResult<()> {
    // Action 按钮仅在 iPhone 15 Pro 及更新机型上可用
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/pressButton", sid.as_str()));
    
    let response = wda.get_client()
        .post(url)
        .json(&json!({ "name": "action" }))
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
        return Err(crate::error::AppError::Wda(
            format!("Action 按钮不可用（可能设备不支持）: 状态码 {}, 响应: {}", status, error_text)
        ));
    }
    
    Ok(())
}
