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
                                let (mut ws_write, _) = ws_stream.split();
                                let mut rx = tx_sub.subscribe();
                                loop {
                                    tokio::select! {
                                        _ = client_token.cancelled() => break,
                                        recv_res = rx.recv() => {
                                            match recv_res {
                                                Ok(frame) => {
                                                    if ws_write.send(Message::Binary(frame.to_vec().into())).await.is_err() { break; }
                                                }
                                                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                                                Err(_) => break,
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }
    }
}
