use async_trait::async_trait;
use tracing::info;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::DragGesture;
use super::builder::W3cActionsBuilder;

pub struct W3cDrag;

#[async_trait]
impl DragGesture for W3cDrag {
    async fn drag(
        &self,
        wda: &WdaClient,
        from_x: f64,
        from_y: f64,
        to_x: f64,
        to_y: f64,
        duration: f64,
    ) -> AppResult<()> {
        info!("[W3C] 执行 DRAG: ({}, {}) -> ({}, {}), duration: {}s",
            from_x, from_y, to_x, to_y, duration);
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/actions", sid.as_str()));
        
        let actions = W3cActionsBuilder::drag(
            from_x.round() as i64,
            from_y.round() as i64,
            to_x.round() as i64,
            to_y.round() as i64,
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
