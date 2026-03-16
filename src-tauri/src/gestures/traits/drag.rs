use async_trait::async_trait;
use crate::error::AppResult;
use crate::clients::WdaClient;

/// 拖拽手势 trait
#[async_trait]
pub trait DragGesture: Send + Sync {
    /// 执行拖拽
    async fn drag(
        &self,
        wda: &WdaClient,
        from_x: f64,
        from_y: f64,
        to_x: f64,
        to_y: f64,
        duration: f64,
    ) -> AppResult<()>;
    
    /// 策略名称
    fn strategy_name(&self) -> &'static str;
}
