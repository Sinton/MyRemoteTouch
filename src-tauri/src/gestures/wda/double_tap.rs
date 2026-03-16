use async_trait::async_trait;
use serde_json::json;
use tracing::info;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::DoubleTapGesture;

pub struct WdaDoubleTap;

#[async_trait]
impl DoubleTapGesture for WdaDoubleTap {
    async fn double_tap(&self, wda: &WdaClient, x: f64, y: f64) -> AppResult<()> {
        info!("[WDA] 执行 DOUBLE_TAP: ({}, {})", x, y);
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/wda/doubleTap", sid.as_str()));
        
        let body = json!({
            "x": x.round() as i64,
            "y": y.round() as i64
        });
        
        let response = wda.get_dedicated_client()
            .post(&url)
            .json(&body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(crate::error::AppError::Wda(format!("DOUBLE TAP 失败: 状态码 {}, 响应: {}", status, error_text)));
        }
        
        Ok(())
    }
    
    fn strategy_name(&self) -> &'static str {
        "WDA"
    }
}
