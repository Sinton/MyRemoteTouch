use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// WDA 服务配置
    pub wda: WdaConfig,
    /// 视频流配置
    pub video: VideoConfig,
    /// 代理配置
    pub proxy: ProxyConfig,
    /// 健康检查配置
    pub health: HealthConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WdaConfig {
    /// WDA 服务地址
    pub url: String,
    /// 请求超时时间（秒）
    pub timeout_secs: u64,
    /// 连接池空闲超时（秒）
    pub pool_idle_timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoConfig {
    /// WebSocket 服务端口
    pub ws_port: u16,
    /// WDA MJPEG 端口
    pub wda_port: u16,
    /// 广播通道缓冲区大小（帧数）
    pub buffer_size: usize,
    /// 默认帧率
    pub default_fps: u32,
    /// 默认质量
    pub default_quality: u8,
    /// 默认缩放比例
    pub default_scale: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// 代理端口映射列表 (本地端口, 设备端口)
    pub port_mappings: Vec<(u16, u16)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthConfig {
    /// 健康检查间隔（秒）
    pub check_interval_secs: u64,
    /// 失败重试延迟（秒）
    pub retry_delay_secs: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            wda: WdaConfig::default(),
            video: VideoConfig::default(),
            proxy: ProxyConfig::default(),
            health: HealthConfig::default(),
        }
    }
}

impl Default for WdaConfig {
    fn default() -> Self {
        Self {
            url: "http://127.0.0.1:8100".to_string(),
            timeout_secs: 12,
            pool_idle_timeout_secs: 120,
        }
    }
}

impl Default for VideoConfig {
    fn default() -> Self {
        Self {
            ws_port: 9999,
            wda_port: 9100,
            buffer_size: 4,
            default_fps: 60,
            default_quality: 80,
            default_scale: 1.0,
        }
    }
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            port_mappings: vec![
                (8100, 8100), // WDA
                (9100, 9100), // MJPEG
            ],
        }
    }
}

impl Default for HealthConfig {
    fn default() -> Self {
        Self {
            check_interval_secs: 20,
            retry_delay_secs: 2,
        }
    }
}

impl WdaConfig {
    pub fn timeout(&self) -> Duration {
        Duration::from_secs(self.timeout_secs)
    }

    pub fn pool_idle_timeout(&self) -> Duration {
        Duration::from_secs(self.pool_idle_timeout_secs)
    }
}

impl HealthConfig {
    pub fn check_interval(&self) -> Duration {
        Duration::from_secs(self.check_interval_secs)
    }

    pub fn retry_delay(&self) -> Duration {
        Duration::from_secs(self.retry_delay_secs)
    }
}
