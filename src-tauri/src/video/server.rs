use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use futures_util::{StreamExt, SinkExt};
use tokio::sync::broadcast;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

/// WsVideoServer - 负责将视频帧通过 WebSocket 分发给前端
pub struct WsVideoServer {
    port: u16,
    tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>,
}

impl WsVideoServer {
    pub fn new(port: u16, tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>) -> Self {
        Self { port, tx }
    }

    pub async fn run(&self, token: CancellationToken) {
        let addr = format!("127.0.0.1:{}", self.port);
        let listener = TcpListener::bind(&addr).await.expect("Failed to bind WS video port");
        
        loop {
            tokio::select! {
                _ = token.cancelled() => break,
                accept_res = listener.accept() => {
                    if let Ok((stream, _)) = accept_res {
                        let tx_sub = Arc::clone(&self.tx);
                        let client_token = token.clone();
                        tokio::spawn(async move {
                            if let Ok(ws_stream) = accept_async(stream).await {
                                println!(">>> [Video-Server] 客户端已连接 WebSocket");
                                let (mut ws_write, _) = ws_stream.split();
                                let mut rx = tx_sub.subscribe();
                                let mut frame_count = 0;
                                let mut lagged_count = 0;
                                loop {
                                    tokio::select! {
                                        _ = client_token.cancelled() => break,
                                        recv_res = rx.recv() => {
                                            match recv_res {
                                                Ok(frame) => {
                                                    frame_count += 1;
                                                    if frame_count % 100 == 0 {
                                                        println!(">>> [Video-Server] 已发送 {} 帧 (丢帧: {})", frame_count, lagged_count);
                                                    }
                                                    
                                                    // 非阻塞发送：如果 WebSocket 发送缓冲区满，跳过此帧
                                                    if let Err(e) = ws_write.send(Message::Binary(frame.to_vec().into())).await {
                                                        // 只有在非正常断开时才打印错误
                                                        // 10053 (ConnectionReset) 和 AlreadyClosed 是切换模式时的正常现象
                                                        let err_str = e.to_string();
                                                        if !err_str.contains("10053") && !err_str.contains("AlreadyClosed") {
                                                            println!(">>> [Video-Server] 发送失败: {}", e);
                                                        }
                                                        break;
                                                    }
                                                }
                                                Err(broadcast::error::RecvError::Lagged(n)) => {
                                                    // 接收端太慢，跳过旧帧，直接获取最新帧
                                                    lagged_count += n;
                                                    if lagged_count % 10 == 0 {
                                                        println!(">>> [Video-Server] ⚠️ 累计丢帧: {} (降低延迟)", lagged_count);
                                                    }
                                                    continue;
                                                }
                                                Err(_) => break,
                                            }
                                        }
                                    }
                                }
                                println!(">>> [Video-Server] 客户端断开 (总帧数: {}, 丢帧: {})", frame_count, lagged_count);
                            }
                        });
                    }
                }
            }
        }
    }
}
