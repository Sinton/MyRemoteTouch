use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::error::AppResult;
use crate::clients::WdaClient;
use tracing::{info, warn, error};
use std::sync::Arc;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TouchPoint {
    pub x: f64,
    pub y: f64,
    pub time: u64,
}

#[tauri::command]
pub async fn send_touch_actions(wda: tauri::State<'_, Arc<WdaClient>>, actions: Vec<TouchPoint>) -> AppResult<()> {
    if actions.is_empty() { 
        warn!("收到空的触控动作列表");
        return Ok(()); 
    }
    
    // 验证所有坐标的有效性
    for (i, point) in actions.iter().enumerate() {
        if !point.x.is_finite() || !point.y.is_finite() {
            error!("第 {} 个点坐标无效: x={}, y={}", i, point.x, point.y);
            return Err(crate::error::AppError::Wda(format!("第 {} 个点坐标无效", i)));
        }
    }
    
    info!("收到 SWIPE 请求: {} 个点", actions.len());
    
    let sid = wda.get_session_id().await;
    let mut pointer_actions = Vec::new();
    let start = &actions[0];
    let end = &actions[actions.len() - 1];
    
    let start_x = start.x.round() as i64;
    let start_y = start.y.round() as i64;
    let end_x = end.x.round() as i64;
    let end_y = end.y.round() as i64;
    
    info!("起点: ({}, {}), 终点: ({}, {})", start_x, start_y, end_x, end_y);
    
    // 计算总滑动时长，限制在 100ms - 800ms 之间，追求极致响应
    let total_duration = (end.time.saturating_sub(start.time)).clamp(100, 800);
    
    // 如果滑动时间超过 300ms，说明用户有拖拽意图，加入 200ms 的长按 Pause 停顿，以触发 iOS 的 hold-and-drag
    let is_drag = total_duration > 300;
    
    info!("滑动时长: {}ms, 是否拖拽: {}", total_duration, is_drag);
    
    pointer_actions.push(json!({ "type": "pointerMove", "duration": 0, "x": start_x, "y": start_y }));
    pointer_actions.push(json!({ "type": "pointerDown", "button": 0 }));
    
    if is_drag {
        pointer_actions.push(json!({ "type": "pause", "duration": 200 }));
    }
    
    // 我们舍弃掉中间所有稀碎的采样点，只给 WDA 发送起点和终点
    pointer_actions.push(json!({ "type": "pointerMove", "duration": total_duration, "x": end_x, "y": end_y }));
    pointer_actions.push(json!({ "type": "pointerUp", "button": 0 }));
    
    let w3c_body = json!({
        "actions": [{
            "type": "pointer",
            "id": "finger1",
            "parameters": { "pointerType": "touch" },
            "actions": pointer_actions
        }]
    });
    
    let url = wda.format_url(&format!("/session/{}/actions", sid.as_str()));
    info!("发送 SWIPE 请求到: {}", url);
    
    // 添加重试机制，只重试 1 次
    let mut last_error = None;
    for attempt in 0..2 {
        if attempt > 0 {
            warn!("SWIPE 请求重试第 {} 次", attempt);
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }
        
        match wda.get_client().post(&url).json(&w3c_body).send().await {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    info!("SWIPE 请求成功: 状态码 {}", status);
                    return Ok(());
                } else {
                    let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
                    error!("SWIPE 请求失败: 状态码 {}, 响应: {}", status, error_text);
                    last_error = Some(crate::error::AppError::Wda(format!("状态码 {}: {}", status, error_text)));
                }
            }
            Err(e) => {
                error!("SWIPE 请求异常 (尝试 {}): {:?}", attempt + 1, e);
                // 记录更详细的错误信息
                if e.is_timeout() {
                    warn!("请求超时 - WDA 可能在处理复杂手势时卡住");
                } else if e.is_connect() {
                    warn!("连接失败 - 无法连接到 WDA 服务");
                } else if e.is_request() {
                    warn!("请求错误 - 连接在发送数据时断开，可能是 WDA 崩溃");
                }
                last_error = Some(e.into());
            }
        }
    }
    
    Err(last_error.unwrap_or_else(|| crate::error::AppError::Wda("未知错误".to_string())))
}

#[tauri::command]
pub async fn send_tap(wda: tauri::State<'_, Arc<WdaClient>>, x: f64, y: f64) -> AppResult<()> {
    // 验证坐标有效性
    if !x.is_finite() || !y.is_finite() {
        error!("收到无效坐标: x={}, y={}", x, y);
        return Err(crate::error::AppError::Wda("坐标值无效 (INFINITY 或 NaN)".to_string()));
    }
    
    let x_int = x.round() as i64;
    let y_int = y.round() as i64;
    
    if x_int < 0 || y_int < 0 {
        error!("收到负数坐标: x={}, y={}", x_int, y_int);
        return Err(crate::error::AppError::Wda("坐标值不能为负数".to_string()));
    }
    
    info!("收到 TAP 请求: x={}, y={}", x_int, y_int);
    
    let sid = wda.get_session_id().await;
    info!("使用 Session ID: {}", sid.as_str());
    
    // 尝试使用坐标点击端点（可能更快）
    // 先尝试 /wda/element/:uuid/click 但我们需要先获取元素
    // 直接使用 W3C Actions，但简化到最少步骤
    
    // 使用最简化的 W3C Actions
    let w3c_body = json!({
        "actions": [{
            "type": "pointer",
            "id": "finger1",
            "parameters": { "pointerType": "touch" },
            "actions": [
                { "type": "pointerMove", "duration": 0, "x": x_int, "y": y_int },
                { "type": "pointerDown", "button": 0 },
                { "type": "pointerUp", "button": 0 }
            ]
        }]
    });
    
    let url = wda.format_url(&format!("/session/{}/actions", sid.as_str()));
    info!("发送 W3C TAP 请求 (简化版)");
    
    // 添加重试机制，只重试 1 次
    let mut last_error = None;
    for attempt in 0..2 {
        if attempt > 0 {
            warn!("TAP 请求重试第 {} 次", attempt);
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }
        
        match wda.get_client().post(&url).json(&w3c_body).send().await {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    info!("TAP 请求成功: 状态码 {}", status);
                    return Ok(());
                } else {
                    let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
                    error!("TAP 请求失败: 状态码 {}, 响应: {}", status, error_text);
                    last_error = Some(crate::error::AppError::Wda(format!("状态码 {}: {}", status, error_text)));
                }
            }
            Err(e) => {
                error!("TAP 请求异常 (尝试 {}): {:?}", attempt + 1, e);
                // 记录更详细的错误信息
                if e.is_timeout() {
                    warn!("请求超时 - 可能是 WDA 响应慢或 usbmuxd 连接不稳定");
                } else if e.is_connect() {
                    warn!("连接失败 - 无法连接到 WDA 服务");
                } else if e.is_request() {
                    warn!("请求错误 - 可能是网络层问题");
                }
                last_error = Some(e.into());
            }
        }
    }
    
    Err(last_error.unwrap_or_else(|| crate::error::AppError::Wda("未知错误".to_string())))
}

#[tauri::command]
pub async fn send_keys(wda: tauri::State<'_, Arc<WdaClient>>, key: String) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/keys", sid.as_str()));
    wda.get_client().post(url).json(&json!({ "value": [key] })).send().await?;
    Ok(())
}
