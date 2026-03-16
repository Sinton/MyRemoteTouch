use std::sync::Arc;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::{
    GestureFactory,
    GestureStrategy,
    SwipeDirection,
    TouchPoint,
};
use tracing::{info, warn};

// ============ 点击操作 ============

#[tauri::command]
pub async fn send_tap(
    wda: tauri::State<'_, Arc<WdaClient>>,
    x: f64,
    y: f64,
    _strategy: Option<GestureStrategy>,
) -> AppResult<()> {
    // 默认使用 W3C Actions（性能与 WDA 相同，但更灵活）
    let gesture = GestureFactory::create_tap(GestureStrategy::W3C);
    gesture.tap(&wda, x, y).await
}

#[tauri::command]
pub async fn send_double_tap(
    wda: tauri::State<'_, Arc<WdaClient>>,
    x: f64,
    y: f64,
    strategy: Option<GestureStrategy>,
) -> AppResult<()> {
    let gesture = GestureFactory::create_double_tap(strategy.unwrap_or(GestureStrategy::Auto));
    gesture.double_tap(&wda, x, y).await
}

#[tauri::command]
pub async fn send_long_press(
    wda: tauri::State<'_, Arc<WdaClient>>,
    x: f64,
    y: f64,
    duration: f64,
    strategy: Option<GestureStrategy>,
) -> AppResult<()> {
    let gesture = GestureFactory::create_long_press(strategy.unwrap_or(GestureStrategy::Auto));
    gesture.long_press(&wda, x, y, duration).await
}

// ============ 滑动操作 ============

#[tauri::command]
pub async fn send_swipe(
    wda: tauri::State<'_, Arc<WdaClient>>,
    direction: String,
    velocity: Option<f64>,
    strategy: Option<GestureStrategy>,
) -> AppResult<()> {
    let dir = SwipeDirection::from_str(&direction)
        .ok_or_else(|| crate::error::AppError::Wda(format!("无效的滑动方向: {}", direction)))?;
    
    let gesture = GestureFactory::create_swipe(strategy.unwrap_or(GestureStrategy::Auto));
    gesture.swipe_direction(&wda, dir, velocity).await
}

#[tauri::command]
pub async fn send_swipe_path(
    wda: tauri::State<'_, Arc<WdaClient>>,
    points: Vec<TouchPoint>,
    strategy: Option<GestureStrategy>,
) -> AppResult<()> {
    // 复杂路径滑动强制使用 W3C（WDA 不支持）
    let final_strategy = match strategy {
        Some(GestureStrategy::WDA) => {
            warn!("复杂路径滑动不支持 WDA 策略，自动切换到 W3C");
            GestureStrategy::W3C
        }
        Some(s) => s,
        None => GestureStrategy::W3C,  // 默认使用 W3C
    };
    
    let gesture = GestureFactory::create_swipe(final_strategy);
    gesture.swipe_path(&wda, &points).await
}

// ============ 拖拽操作 ============

#[tauri::command]
pub async fn send_drag(
    wda: tauri::State<'_, Arc<WdaClient>>,
    from_x: f64,
    from_y: f64,
    to_x: f64,
    to_y: f64,
    duration: Option<f64>,
    strategy: Option<GestureStrategy>,
) -> AppResult<()> {
    let gesture = GestureFactory::create_drag(strategy.unwrap_or(GestureStrategy::Auto));
    gesture.drag(&wda, from_x, from_y, to_x, to_y, duration.unwrap_or(0.5)).await
}

// ============ 兼容旧 API（向后兼容）============

#[tauri::command]
pub async fn send_touch_actions(
    wda: tauri::State<'_, Arc<WdaClient>>,
    actions: Vec<TouchPoint>,
) -> AppResult<()> {
    info!("收到旧版 send_touch_actions 请求，自动判断手势类型");
    
    if actions.is_empty() {
        warn!("收到空的触控动作列表");
        return Ok(());
    }
    
    let start = &actions[0];
    let end = &actions[actions.len() - 1];
    
    let duration = end.time.saturating_sub(start.time);
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let distance = (dx * dx + dy * dy).sqrt();
    
    // 判断手势类型
    if distance < 5.0 && duration < 300 {
        // 点击
        info!("识别为点击手势");
        send_tap(wda, start.x, start.y, None).await
    } else if duration > 300 || distance > 100.0 {
        // 拖拽
        info!("识别为拖拽手势");
        send_drag(wda, start.x, start.y, end.x, end.y, Some(duration as f64 / 1000.0), None).await
    } else {
        // 复杂滑动
        info!("识别为复杂滑动手势");
        send_swipe_path(wda, actions, None).await
    }
}

// ============ 键盘输入 ============

#[tauri::command]
pub async fn send_keys(wda: tauri::State<'_, Arc<WdaClient>>, key: String) -> AppResult<()> {
    use serde_json::json;
    
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/keys", sid.as_str()));
    wda.get_client().post(url).json(&json!({ "value": [key] })).send().await?;
    Ok(())
}
