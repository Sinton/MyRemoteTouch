use async_trait::async_trait;
use crate::error::AppResult;
use crate::clients::WdaClient;

/// 长按手势 trait
#[async_trait]
pub trait LongPressGesture: Send + Sync {
    /// 执行长按
    async fn long_press(
        &self,
        wda: &WdaClient,
        x: f64,
        y: f64,
        duration: f64,
    ) -> AppResult<()>;
    
    /// 策略名称
    fn strategy_name(&self) -> &'static str;
}
