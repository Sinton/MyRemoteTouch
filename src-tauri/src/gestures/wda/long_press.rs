use async_trait::async_trait;
use serde_json::json;
use tracing::info;
use crate::error::AppResult;
use crate::clients::WdaClient;
use crate::gestures::traits::LongPressGesture;

pub struct WdaLongPress;

#[async_trait]
impl LongPressGesture for WdaLongPress {
    async fn long_press(
        &self,
        wda: &WdaClient,
        x: f64,
        y: f64,
        duration: f64,
    ) -> AppResult<()> {
        info!("[WDA] 执行 LONG_PRESS: ({}, {}), duration: {}s", x, y, duration);
        
        let sid = wda.get_session_id().await;
        let url = wda.format_url(&format!("/session/{}/wda/touchAndHold", sid.as_str()));
        
        let body = json!({
            "x": x.round() as i64,
            "y": y.round() as i64,
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
            return Err(crate::error::AppError::Wda(format!("LONG PRESS 失败: 状态码 {}, 响应: {}", status, error_text)));
        }
        
        Ok(())
    }
    
    fn strategy_name(&self) -> &'static str {
        "WDA"
    }
}
