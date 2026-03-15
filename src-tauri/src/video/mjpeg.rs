use tokio::net::TcpStream;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::sync::broadcast;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

/// MjpegProvider - 负责订阅 WDA 的 MJPEG 视频流并解析成帧
pub struct MjpegProvider {
    wda_port: u16,
    tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>,
}

impl MjpegProvider {
    pub fn new(wda_port: u16, tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>) -> Self {
        Self { wda_port, tx }
    }

    pub async fn run(&mut self, token: CancellationToken) {
        loop {
            tokio::select! {
                _ = token.cancelled() => break,
                _ = self.process_stream() => {
                    // 如果流程退出（比如断连），等待一会儿再重连
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
            }
        }
    }

    async fn process_stream(&mut self) {
        let addr = format!("127.0.0.1:{}", self.wda_port);
        if let Ok(mut device_stream) = TcpStream::connect(&addr).await {
            let request = "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n";
            if device_stream.write_all(request.as_bytes()).await.is_err() {
                return;
            }

            let mut reader = BufReader::with_capacity(512 * 1024, device_stream);
            
            // 消耗掉初始 HTTP 响应头
            let mut line = String::new();
            loop {
                line.clear();
                if reader.read_line(&mut line).await.unwrap_or(0) == 0 { return; }
                if line == "\r\n" || line == "\n" { break; }
            }

            // 解析 Multipart 流
            loop {
                line.clear();
                if reader.read_line(&mut line).await.unwrap_or(0) == 0 { break; }
                
                let lower_line = line.trim().to_lowercase();
                if lower_line.starts_with("content-length:") {
                    if let Some(len_str) = lower_line.split(':').nth(1) {
                        if let Ok(len) = len_str.trim().parse::<usize>() {
                            // 跳过头部直到图片数据前的空行
                            loop {
                                line.clear();
                                if reader.read_line(&mut line).await.unwrap_or(0) == 0 { return; }
                                if line == "\r\n" || line == "\n" { break; }
                            }

                            let mut frame_data = vec![0u8; len];
                            if reader.read_exact(&mut frame_data).await.is_ok() {
                                let _ = self.tx.send(Arc::new(frame_data));
                            } else {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}
