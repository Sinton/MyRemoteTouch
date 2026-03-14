use serde_json::json;
use std::sync::Mutex;
use serde::Deserialize;
use crate::error::{AppResult, AppError};

#[derive(Deserialize, Debug)]
pub struct WdaResponse<T> {
    pub value: T,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct WdaStatus {
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub value: Option<serde_json::Value>,
}

pub struct WdaClient {
    client: reqwest::Client,
    session_id: Mutex<Option<String>>,
    base_url: String,
}

impl WdaClient {
    pub fn new(base_url: &str) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .tcp_nodelay(true)
            .pool_idle_timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("Failed to build reqwest client");

        Self {
            client,
            session_id: Mutex::new(None),
            base_url: base_url.to_string(),
        }
    }

    pub fn get_client(&self) -> &reqwest::Client {
        &self.client
    }

    pub async fn get_session_id(&self) -> String {
        {
            let lock = self.session_id.lock().unwrap();
            if let Some(id) = &*lock {
                if !id.is_empty() && id != "any" {
                    return id.clone();
                }
            }
        }

        match self.try_recover_or_create_session().await {
            Ok(id) => {
                self.set_session(id.clone()).await;
                id
            }
            Err(e) => {
                eprintln!(">>> [WDA] Session 恢复/创建失败: {:?}", e);
                "any".to_string()
            }
        }
    }

    async fn try_recover_or_create_session(&self) -> AppResult<String> {
        // 尝试从状态接口恢复
        let res = self.client.get(format!("{}/status", self.base_url)).send().await?;
        if let Ok(status) = res.json::<WdaStatus>().await {
            let sid = status.session_id
                .or_else(|| {
                    status.value.as_ref()
                        .and_then(|v| v.get("sessionId"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                });
            if let Some(id) = sid {
                if !id.is_empty() && id != "null" {
                    return Ok(id);
                }
            }
        }

        // 创建新 Session
        println!(">>> [WDA] 正在重建物理 Session (极速模式)...");
        let caps = json!({ "capabilities": { "alwaysMatch": {} } });
        let res = self.client.post(format!("{}/session", self.base_url))
            .json(&caps)
            .send()
            .await?;
        
        let body = res.json::<serde_json::Value>().await?;
        let sid = body["sessionId"]
            .as_str()
            .or_else(|| body["value"]["sessionId"].as_str())
            .ok_or_else(|| AppError::Wda("无法在响应中找到 sessionId".to_string()))?;
        
        Ok(sid.to_string())
    }

    async fn set_session(&self, id: String) {
        {
            let mut lock = self.session_id.lock().unwrap();
            *lock = Some(id.clone());
        }
        let _ = self.apply_settings(&id).await;
    }

    async fn apply_settings(&self, sid: &str) -> AppResult<()> {
        self.update_settings_for_session(sid, 100, 60).await
    }

    pub async fn update_settings(&self, quality: u8, framerate: u8) -> AppResult<()> {
        let sid = self.get_session_id().await;
        self.update_settings_for_session(&sid, quality, framerate).await
    }

    async fn update_settings_for_session(&self, sid: &str, quality: u8, framerate: u8) -> AppResult<()> {
        let settings = json!({
            "settings": {
                "waitForQuiescence": false,
                "waitForIdle": false,
                "animationCoolOffTimeout": 0,
                "shouldUseCompactResponses": true,
                "elementResponseAttributes": "type,label",
                "mjpegServerScreenshotQuality": quality,
                "mjpegServerFramerate": framerate,
                "screenshotQuality": 1
            }
        });
        self.client
            .post(format!("{}/session/{}/appium/settings", self.base_url, sid))
            .json(&settings)
            .send()
            .await?;
        Ok(())
    }

    pub fn format_url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    pub async fn check_health(&self) -> bool {
        match self.client.get(format!("{}/status", self.base_url)).send().await {
            Ok(res) => res.status().is_success(),
            Err(_) => false,
        }
    }
}
