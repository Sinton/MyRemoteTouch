use async_trait::async_trait;
use serde_json::json;
use tracing::{info, warn};
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::SwipeGesture;
use crate::gestures::types::{SwipeDirection, TouchPoint};

pub struct WdaSwipe;

#[async_trait]
impl SwipeGesture for WdaSwipe {
    async fn swipe_direction(
        &self,
        wda: &WdaClient,
        direction: SwipeDirection,
        velocity: Option<f64>,
    ) -> AppResult<()> {
        info!("[WDA] 执行 SWIPE: direction={}, velocity={:?}", 
            direction.as_str(), velocity);
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/wda/swipe", sid.as_str()));
        
        let mut body = json!({
            "direction": direction.as_str()
        });
        
        if let Some(v) = velocity {
            body["velocity"] = json!(v);
        }
        
        let response = wda.get_dedicated_client()
            .post(&url)
            .json(&body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(crate::error::AppError::Wda(format!("SWIPE 失败: 状态码 {}, 响应: {}", status, error_text)));
        }
        
        Ok(())
    }
    
    async fn swipe_path(
        &self,
        _wda: &WdaClient,
        _points: &[TouchPoint],
    ) -> AppResult<()> {
        warn!("[WDA] 不支持复杂路径滑动");
        Err(crate::error::AppError::Wda(
            "WDA 不支持复杂路径滑动，请使用 W3C 策略".to_string()
        ))
    }
    
    fn supports_direction_swipe(&self) -> bool {
        true
    }
    
    fn supports_path_swipe(&self) -> bool {
        false  // WDA 不支持路径滑动
    }
    
    fn strategy_name(&self) -> &'static str {
        "WDA"
    }
}
