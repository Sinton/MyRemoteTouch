use async_trait::async_trait;
use crate::error::AppResult;
use crate::clients::WdaClient;

/// 双击手势 trait
#[async_trait]
pub trait DoubleTapGesture: Send + Sync {
    /// 执行双击
    async fn double_tap(&self, wda: &WdaClient, x: f64, y: f64) -> AppResult<()>;
    
    /// 策略名称
    fn strategy_name(&self) -> &'static str;
}
