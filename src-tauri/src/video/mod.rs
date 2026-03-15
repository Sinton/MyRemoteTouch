use tokio::sync::broadcast;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use crate::video::mjpeg::MjpegProvider;
use crate::video::server::WsVideoServer;

pub mod mjpeg;
pub mod server;
pub mod config;

use std::sync::atomic::AtomicBool;

pub struct StreamingState {
    pub enabled: AtomicBool,
}

impl StreamingState {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: AtomicBool::new(enabled),
        }
    }
}

/// 视频流模块入口 - 仅使用 MJPEG 方案
pub async fn start_video_service(ws_port: u16, wda_port: u16, state: Arc<StreamingState>, token: CancellationToken) {
    // 使用更小的广播通道容量（4 帧）以进一步降低延迟
    let (tx, _) = broadcast::channel::<Arc<Vec<u8>>>(4);
    let tx = Arc::new(tx);

    let ws_server = WsVideoServer::new(ws_port, Arc::clone(&tx));
    let server_token = token.clone();
    tokio::spawn(async move {
        ws_server.run(server_token).await;
    });

    println!(">>> [Video] WebSocket 视频流服务器已在端口 {} 启动", ws_port);

    let provider_tx = Arc::clone(&tx);
    let provider_token = token.clone();
    let provider_state = Arc::clone(&state);
    
    tokio::spawn(async move {
        println!(">>> [Video] 启动 MJPEG 视频流提供者后台任务...");
        let mut mjpeg_provider = MjpegProvider::new(wda_port, provider_tx, provider_state);
        mjpeg_provider.run(provider_token).await;
    });
}
