use async_trait::async_trait;
use tracing::{info, warn};
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::SwipeGesture;
use crate::gestures::types::{SwipeDirection, TouchPoint};
use super::builder::W3cActionsBuilder;

pub struct W3cSwipe;

#[async_trait]
impl SwipeGesture for W3cSwipe {
    async fn swipe_direction(
        &self,
        _wda: &WdaClient,
        direction: SwipeDirection,
        _velocity: Option<f64>,
    ) -> AppResult<()> {
        warn!("[W3C] 简单方向滑动建议使用 WDA 策略以获得更好性能，当前方向: {}", direction.as_str());
        Err(crate::error::AppError::Wda(
            "W3C 策略不支持简单方向滑动，请使用 WDA 策略".to_string()
        ))
    }
    
    async fn swipe_path(
        &self,
        wda: &WdaClient,
        points: &[TouchPoint],
    ) -> AppResult<()> {
        info!("[W3C] 执行 SWIPE_PATH: {} 个点", points.len());
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/actions", sid.as_str()));
        
        let actions = W3cActionsBuilder::swipe_path(points);
        
        wda.get_dedicated_client()
            .post(&url)
            .json(&actions)
            .send()
            .await?;
        
        Ok(())
    }
    
    fn supports_direction_swipe(&self) -> bool {
        false  // W3C 不推荐用于简单方向滑动
    }
    
    fn supports_path_swipe(&self) -> bool {
        true
    }
    
    fn strategy_name(&self) -> &'static str {
        "W3C"
    }
}
