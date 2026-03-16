use async_trait::async_trait;
use tracing::info;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::LongPressGesture;
use super::builder::W3cActionsBuilder;

pub struct W3cLongPress;

#[async_trait]
impl LongPressGesture for W3cLongPress {
    async fn long_press(
        &self,
        wda: &WdaClient,
        x: f64,
        y: f64,
        duration: f64,
    ) -> AppResult<()> {
        info!("[W3C] 执行 LONG_PRESS: ({}, {}), duration: {}s", x, y, duration);
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/actions", sid.as_str()));
        
        let actions = W3cActionsBuilder::long_press(
            x.round() as i64,
            y.round() as i64,
            (duration * 1000.0) as u64,
        );
        
        wda.get_dedicated_client()
            .post(&url)
            .json(&actions)
            .send()
            .await?;
        
        Ok(())
    }
    
    fn strategy_name(&self) -> &'static str {
        "W3C"
    }
}
