use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_util::sync::CancellationToken;
use tracing::info;
use crate::video::{StreamingState, mjpeg::MjpegProvider, server::WsVideoServer};
use crate::config::VideoConfig;

/// 视频流服务
pub struct VideoService {
    config: VideoConfig,
    streaming_state: Arc<StreamingState>,
}

impl VideoService {
    pub fn new(config: VideoConfig, streaming_state: Arc<StreamingState>) -> Self {
        Self {
            config,
            streaming_state,
        }
    }

    /// 启动视频流服务
    pub async fn start(self, token: CancellationToken) {
        let (tx, _) = broadcast::channel::<Arc<Vec<u8>>>(self.config.buffer_size);
        let tx = Arc::new(tx);

        // 启动 WebSocket 服务器
        let ws_server = WsVideoServer::new(self.config.ws_port, Arc::clone(&tx));
        let server_token = token.clone();
        tokio::spawn(async move {
            ws_server.run(server_token).await;
        });

        info!("WebSocket 视频流服务器已在端口 {} 启动", self.config.ws_port);

        // 启动 MJPEG 提供者
        let provider_tx = Arc::clone(&tx);
        let provider_token = token.clone();
        let provider_state = Arc::clone(&self.streaming_state);
        let wda_port = self.config.wda_port;
        
        tokio::spawn(async move {
            info!("启动 MJPEG 视频流提供者后台任务...");
            let mut mjpeg_provider = MjpegProvider::new(wda_port, provider_tx, provider_state);
            mjpeg_provider.run(provider_token).await;
        });
    }
}
