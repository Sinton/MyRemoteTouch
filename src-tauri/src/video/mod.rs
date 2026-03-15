use tokio::sync::broadcast;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use crate::video::mjpeg::MjpegProvider;
use crate::video::server::WsVideoServer;

pub mod mjpeg;
pub mod h264;
pub mod h264_dvt;
pub mod server;

/// 视频流模块入口：负责协调不同的视频源（MJPEG/H264）和分发服务器
pub async fn start_video_service(ws_port: u16, wda_port: u16, token: CancellationToken) {
    // 1. 创建共享的广播通道 (容量10帧，防止堆积)
    let (tx, _) = broadcast::channel::<Arc<Vec<u8>>>(10);
    let tx = Arc::new(tx);

    // 2. 启动 MJPEG 备选方案提供者 (方案 A)
    let mjpeg_tx = Arc::clone(&tx);
    let mjpeg_token = token.clone();
    tokio::spawn(async move {
        let mut provider = MjpegProvider::new(wda_port, mjpeg_tx);
        provider.run(mjpeg_token).await;
    });

    // 3. 启动 H.264 原生流提供者 (方案 C)
    let h264_tx = Arc::clone(&tx);
    let h264_token = token.clone();
    tokio::spawn(async move {
        let mut provider = h264::H264Provider::new(h264_tx);
        provider.run(h264_token).await;
    });

    // 4. 启动 WebSocket 分发服务器
    let server_token = token.clone();
    let ws_server = WsVideoServer::new(ws_port, tx);
    ws_server.run(server_token).await;
}
