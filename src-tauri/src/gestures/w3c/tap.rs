use async_trait::async_trait;
use tracing::info;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::TapGesture;
use super::builder::W3cActionsBuilder;

pub struct W3cTap;

#[async_trait]
impl TapGesture for W3cTap {
    async fn tap(&self, wda: &WdaClient, x: f64, y: f64) -> AppResult<()> {
        info!("[W3C] 执行 TAP: ({}, {})", x, y);
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/actions", sid.as_str()));
        
        let actions = W3cActionsBuilder::tap(x.round() as i64, y.round() as i64);
        
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
