use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use crate::config::AppConfig;
use crate::clients::WdaClient;
use crate::video::StreamingState;
use crate::services::{ProxyManager, DeviceManager};
use tracing::info;

/// 应用全局状态
pub struct AppState {
    /// 应用配置
    #[allow(dead_code)]
    config: Arc<AppConfig>,
    /// WDA 客户端
    wda_client: Arc<WdaClient>,
    /// 视频流状态
    streaming_state: Arc<StreamingState>,
    /// 代理管理器
    proxy_manager: Arc<ProxyManager>,
    /// 设备管理器
    device_manager: Arc<DeviceManager>,
    /// 取消令牌
    cancel_token: CancellationToken,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new(config: AppConfig) -> Self {
        let config = Arc::new(config);
        let cancel_token = CancellationToken::new();
        
        let wda_client = Arc::new(WdaClient::new(
            &config.wda.url,
            config.wda.timeout(),
            config.wda.pool_idle_timeout(),
        ));
        
        // 默认开启后台抓流（对应前端默认的标准模式）
        let streaming_state = Arc::new(StreamingState::new(true));
        
        // 创建设备管理器
        let device_manager = Arc::new(DeviceManager::new());
        
        let proxy_manager = Arc::new(ProxyManager::new(
            cancel_token.clone(),
            config.proxy.port_mappings.clone(),
            Arc::clone(&device_manager),
        ));

        Self {
            config,
            wda_client,
            streaming_state,
            proxy_manager,
            device_manager,
            cancel_token,
        }
    }

    /// 获取配置
    #[allow(dead_code)]
    pub fn config(&self) -> &Arc<AppConfig> {
        &self.config
    }

    /// 获取 WDA 客户端
    pub fn wda_client(&self) -> &Arc<WdaClient> {
        &self.wda_client
    }

    /// 获取视频流状态
    pub fn streaming_state(&self) -> &Arc<StreamingState> {
        &self.streaming_state
    }

    /// 获取代理管理器
    pub fn proxy_manager(&self) -> &Arc<ProxyManager> {
        &self.proxy_manager
    }

    /// 获取设备管理器
    pub fn device_manager(&self) -> &Arc<DeviceManager> {
        &self.device_manager
    }

    /// 获取取消令牌
    pub fn cancel_token(&self) -> &CancellationToken {
        &self.cancel_token
    }

    /// 关闭应用
    pub fn shutdown(&self) {
        info!("应用正在关闭...");
        self.cancel_token.cancel();
    }
}
