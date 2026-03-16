use async_trait::async_trait;
use serde_json::json;
use tracing::info;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::DragGesture;

pub struct WdaDrag;

#[async_trait]
impl DragGesture for WdaDrag {
    async fn drag(
        &self,
        wda: &WdaClient,
        from_x: f64,
        from_y: f64,
        to_x: f64,
        to_y: f64,
        duration: f64,
    ) -> AppResult<()> {
        info!("[WDA] 执行 DRAG: ({}, {}) -> ({}, {}), duration: {}s",
            from_x, from_y, to_x, to_y, duration);
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/wda/dragfromtoforduration", sid.as_str()));
        
        let body = json!({
            "fromX": from_x.round() as i64,
            "fromY": from_y.round() as i64,
            "toX": to_x.round() as i64,
            "toY": to_y.round() as i64,
            "duration": duration
        });
        
        let response = wda.get_dedicated_client()
            .post(&url)
            .json(&body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "无法读取响应".to_string());
            return Err(crate::error::AppError::Wda(format!("DRAG 失败: 状态码 {}, 响应: {}", status, error_text)));
        }
        
        Ok(())
    }
    
    fn strategy_name(&self) -> &'static str {
        "WDA"
    }
}
