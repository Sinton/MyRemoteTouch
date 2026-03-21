use serde_json::json;
use std::sync::Arc;
use parking_lot::RwLock;
use serde::Deserialize;
use crate::error::{AppResult, AppError};
use tracing::{info, warn, debug};

#[derive(Deserialize, Debug)]
pub struct WdaResponse<T> {
    pub value: T,
    #[allow(dead_code)]
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
    dedicated_client: reqwest::Client, // 专用客户端，用于短平快的操作（如点击）
    session_id: Arc<RwLock<Option<Arc<String>>>>,
    pub(crate) base_url: String,  // 允许在 crate 内访问
}

impl WdaClient {
    pub fn new(base_url: &str, timeout: std::time::Duration, pool_idle_timeout: std::time::Duration) -> Self {
        let client = reqwest::Client::builder()
            .timeout(timeout)
            .connect_timeout(std::time::Duration::from_secs(5))  // 连接超时
            .tcp_nodelay(true)
            .tcp_keepalive(Some(std::time::Duration::from_secs(60)))  // TCP keep-alive
            .pool_idle_timeout(pool_idle_timeout)
            .pool_max_idle_per_host(10)  // 每个 host 保持 10 个空闲连接
            .http1_only()  // 强制使用 HTTP/1.1，更稳定
            .no_proxy()  // 禁用代理，直接连接本地端口
            .build()
            .expect("Failed to build reqwest client");

        // 专用客户端：用于触控操作，启用连接复用以提升性能
        let dedicated_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10)) // 10秒超时
            .connect_timeout(std::time::Duration::from_secs(2))
            .tcp_nodelay(true)
            .tcp_keepalive(Some(std::time::Duration::from_secs(60)))  // 启用 TCP keep-alive
            .pool_idle_timeout(std::time::Duration::from_secs(90))  // 连接池空闲超时
            .pool_max_idle_per_host(5)  // 保持 5 个空闲连接，复用连接
            .http1_only()
            .no_proxy()
            .build()
            .expect("Failed to build dedicated reqwest client");

        Self {
            client,
            dedicated_client,
            session_id: Arc::new(RwLock::new(None)),
            base_url: base_url.to_string(),
        }
    }

    pub fn get_client(&self) -> &reqwest::Client {
        &self.client
    }

    pub fn get_dedicated_client(&self) -> &reqwest::Client {
        &self.dedicated_client
    }

    pub async fn get_session_id(&self) -> Arc<String> {
        {
            let lock = self.session_id.read();
            if let Some(id) = &*lock {
                if !id.is_empty() && id.as_str() != "any" {
                    return Arc::clone(id);
                }
            }
        }

        match self.try_recover_or_create_session().await {
            Ok(id) => {
                let arc_id = Arc::new(id);
                self.set_session(Arc::clone(&arc_id)).await;
                
                // 立即应用低延迟设置
                info!("应用低延迟设置到新 Session");
                if let Err(e) = self.apply_low_latency_settings(&arc_id).await {
                    warn!("应用低延迟设置失败: {}", e);
                }
                
                arc_id
            }
            Err(e) => {
                warn!("Session 恢复/创建失败: {}", e);
                Arc::new("any".to_string())
            }
        }
    }

    async fn try_recover_or_create_session(&self) -> AppResult<String> {
        // 尝试从状态接口恢复
        let res = self.client
            .get(format!("{}/status", self.base_url))
            .send()
            .await
            .map_err(|e| AppError::WdaConnection(format!("无法连接到 WDA: {}", e)))?;
        
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
                    info!("恢复已有 WDA Session: {}", id);
                    return Ok(id);
                }
            }
        }

        // 创建新 Session
        info!("正在创建新 WDA Session...");
        let caps = json!({ "capabilities": { "alwaysMatch": {} } });
        let res = self.client
            .post(format!("{}/session", self.base_url))
            .json(&caps)
            .send()
            .await
            .map_err(|e| AppError::WdaSession(format!("创建 Session 失败: {}", e)))?;
        
        let body = res.json::<serde_json::Value>().await?;
        let sid = body["sessionId"]
            .as_str()
            .or_else(|| body["value"]["sessionId"].as_str())
            .ok_or_else(|| AppError::WdaSession("响应中未找到 sessionId".to_string()))?;
        
        info!("新 WDA Session 创建成功: {}", sid);
        Ok(sid.to_string())
    }

    async fn set_session(&self, id: Arc<String>) {
        let mut lock = self.session_id.write();
        *lock = Some(id);
    }

    /// 应用低延迟设置（专门用于触控操作）
    pub async fn apply_low_latency_settings(&self, sid: &str) -> AppResult<()> {
        let settings = json!({
            "settings": {
                "waitForQuiescence": false,      // 不等待应用进入静止状态 (核心优化)
                "waitForIdleTimeout": 0,         // 不等空闲
                "animationCoolOffTimeout": 0,    // 不等动画结束
                "snapshotTimeout": 10,           // 快照超时
                "shouldUseCompactId": true,      // 压缩 ID
                "shouldUseCompactResponses": true,
                "elementResponseAttributes": "type,label,rect"
            }
        });
        
        let response = self.client
            .post(format!("{}/session/{}/appium/settings", self.base_url, sid))
            .json(&settings)
            .send()
            .await?;
        
        if response.status().is_success() {
            info!("低延迟补丁应用成功: waitForQuiescence=OFF");
        } else {
            warn!("低延迟补丁应用失败: {}", response.status());
        }
        
        Ok(())
    }

    pub async fn update_settings(&self, quality: u8, framerate: u8) -> AppResult<()> {
        let sid = self.get_session_id().await;
        self.update_settings_for_session(&sid, quality, framerate, None).await
    }

    pub async fn update_settings_with_scale(&self, quality: u8, framerate: u8, scale: f32) -> AppResult<()> {
        let sid = self.get_session_id().await;
        self.update_settings_for_session(&sid, quality, framerate, Some(scale)).await
    }

    async fn update_settings_for_session(&self, sid: &str, quality: u8, framerate: u8, scale: Option<f32>) -> AppResult<()> {
        // 确定最终的缩放因子
        let final_scale = scale.unwrap_or(100.0);
        
        let settings_obj = serde_json::json!({
            "waitForQuiescence": false,
            "shouldUseCompactResponses": true,
            "elementResponseAttributes": "type,label,rect",
            "mjpegServerScreenshotQuality": quality,
            "mjpegServerFramerate": framerate,
            "mjpegScalingFactor": final_scale,
            "screenshotQuality": 3,
            "waitForIdleTimeout": 0, // 禁用等待空闲，极致降低延迟
            "animationCoolOffTimeout": 0  // 禁用动画冷却
        });
        
        let settings = json!({
            "settings": settings_obj
        });
        
        info!("应用 WDA 设置 - 质量:{:.0}%, 帧率:{}fps, 缩放:{:.0}%, 低延迟模式:ON", quality, framerate, final_scale);
        
        let response = self.client
            .post(format!("{}/session/{}/appium/settings", self.base_url, sid))
            .json(&settings)
            .send()
            .await?;
        
        if response.status().is_success() {
            info!("WDA 设置应用成功");
        } else {
            warn!("WDA 设置应用失败: {}", response.status());
        }
        
        Ok(())
    }

    pub fn format_url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    pub async fn check_health(&self) -> AppResult<()> {
        let response = self.client
            .get(format!("{}/status", self.base_url))
            .send()
            .await
            .map_err(|e| AppError::HealthCheck(format!("请求失败: {}", e)))?;
        
        if response.status().is_success() {
            Ok(())
        } else {
            Err(AppError::HealthCheck(format!("状态码: {}", response.status())))
        }
    }

    pub async fn get_current_settings(&self) -> AppResult<serde_json::Value> {
        let sid = self.get_session_id().await;
        let url = format!("{}/session/{}/appium/settings", self.base_url, sid.as_str());
        let res = self.client.get(&url).send().await?;
        let body = res.json::<serde_json::Value>().await?;
        Ok(body)
    }

    /// 查找元素 (通用方法)
    pub async fn find_element(&self, strategy: &str, value: &str) -> AppResult<String> {
        let sid = self.get_session_id().await;
        let body = serde_json::json!({
            "using": strategy,
            "value": value
        });

        let url = format!("{}/session/{}/element", self.base_url, sid.as_str());
        let res = self.client.post(&url).json(&body).send().await?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            return Err(AppError::Wda(format!("查找元素失败: 状态码 {}, 响应: {}", status, text)));
        }

        let body: serde_json::Value = res.json().await?;
        
        // WDA 可能返回 ELEMENT 或 element-6066-11e4-a52e-4f735466cecf
        let value = &body["value"];
        let element_id = value["ELEMENT"]
            .as_str()
            .or_else(|| value["element-6066-11e4-a52e-4f735466cecf"].as_str())
            .ok_or_else(|| AppError::Wda(format!("响应中未找到有效的 Element ID: {:?}", body)))?;

        Ok(element_id.to_string())
    }

    /// 通过文本内容查找元素 (使用 Predicate 匹配 label)
    pub async fn find_element_by_label(&self, label: &str) -> AppResult<String> {
        // 构造 Predicate String: label == 'xxx'
        let predicate = format!("label == '{}'", label);
        self.find_element("predicate string", &predicate).await
    }

    /// 获取元素的矩形区域 (x, y, width, height)
    pub async fn get_element_rect(&self, element_id: &str) -> AppResult<serde_json::Value> {
        let sid = self.get_session_id().await;
        let url = format!("{}/session/{}/element/{}/rect", self.base_url, sid.as_str(), element_id);
        
        let res = self.client.get(&url).send().await?;
        if !res.status().is_success() {
            return Err(AppError::Wda(format!("获取元素位置失败: {}", res.status())));
        }

        let body: serde_json::Value = res.json().await?;
        Ok(body["value"].clone())
    }

    /// 获取元素属性 (如 label, name, type)
    pub async fn get_element_attribute(&self, element_id: &str, name: &str) -> AppResult<String> {
        let sid = self.get_session_id().await;
        let url = format!("{}/session/{}/element/{}/attribute/{}", self.base_url, sid.as_str(), element_id, name);
        
        let res = self.client.get(&url).send().await?;
        let body: serde_json::Value = res.json().await?;
        
        let value = body["value"].as_str().unwrap_or_default().to_string();
        
        // 调试：检查字符串长度和字节长度
        if !value.is_empty() {
            debug!(
                "[WDA] get_element_attribute({}, {}): value='{}' (chars={}, bytes={})",
                element_id, name, value, value.chars().count(), value.len()
            );
        }
        
        Ok(value)
    }

    /// 获取元素的文本 Label
    pub async fn get_element_label(&self, element_id: &str) -> AppResult<String> {
        self.get_element_attribute(element_id, "label").await
    }

    /// 获取界面 UI 源码 (XML 结构)
    pub async fn get_source_xml(&self) -> AppResult<String> {
        let sid = self.get_session_id().await;
        // 默认不带 format=json 即为 XML 格式
        let url = format!("{}/session/{}/source", self.base_url, sid.as_str());
        
        let res = self.client.get(&url).send().await?;
        let body: serde_json::Value = res.json().await?;
        
        // WDA 的 XML 源码通常在 value 字段中
        let xml = body["value"].as_str().unwrap_or_default().to_string();
        Ok(xml)
    }

    /// 获取界面 UI 源码 (JSON 结构)
    pub async fn get_source(&self) -> AppResult<serde_json::Value> {
        let sid = self.get_session_id().await;
        let url = format!("{}/session/{}/source?format=json", self.base_url, sid.as_str());
        
        let res = self.client.get(&url).send().await?;
        let body: serde_json::Value = res.json().await?;
        Ok(body)
    }
}

