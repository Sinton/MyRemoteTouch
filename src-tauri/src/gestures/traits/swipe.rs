use async_trait::async_trait;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::types::{SwipeDirection, TouchPoint};

/// 滑动手势 trait
#[async_trait]
pub trait SwipeGesture: Send + Sync {
    /// 简单方向滑动
    async fn swipe_direction(
        &self,
        wda: &WdaClient,
        direction: SwipeDirection,
        velocity: Option<f64>,
    ) -> AppResult<()>;
    
    /// 复杂路径滑动
    async fn swipe_path(
        &self,
        wda: &WdaClient,
        points: &[TouchPoint],
    ) -> AppResult<()>;
    
    /// 是否支持方向滑动
    fn supports_direction_swipe(&self) -> bool {
        true
    }
    
    /// 是否支持路径滑动
    fn supports_path_swipe(&self) -> bool {
        true
    }
    
    /// 策略名称
    fn strategy_name(&self) -> &'static str;
}
