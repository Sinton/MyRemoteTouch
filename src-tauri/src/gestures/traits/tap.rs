use async_trait::async_trait;
use crate::error::AppResult;
use crate::clients::WdaClient;

/// 点击手势 trait
#[async_trait]
pub trait TapGesture: Send + Sync {
    /// 执行点击
    async fn tap(&self, wda: &WdaClient, x: f64, y: f64) -> AppResult<()>;
    
    /// 策略名称
    fn strategy_name(&self) -> &'static str;
}
