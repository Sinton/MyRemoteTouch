use tokio::net::TcpStream;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::sync::broadcast;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

use std::sync::atomic::Ordering;
use crate::video::StreamingState;

/// MjpegProvider - 负责订阅 WDA 的 MJPEG 视频流并解析成帧
pub struct MjpegProvider {
    wda_port: u16,
    tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>,
    state: Arc<StreamingState>,
}

impl MjpegProvider {
    pub fn new(wda_port: u16, tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>, state: Arc<StreamingState>) -> Self {
        Self { wda_port, tx, state }
    }

    pub async fn run(&mut self, token: CancellationToken) {
        loop {
            // 检查当前模式是否需要后台抓流（非极速模式才需要）
            if !self.state.enabled.load(Ordering::Relaxed) {
                tokio::select! {
                    _ = token.cancelled() => break,
                    _ = tokio::time::sleep(std::time::Duration::from_millis(500)) => continue,
                }
            }

            tokio::select! {
                _ = token.cancelled() => break,
                _ = self.process_stream() => {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        }
    }

    async fn process_stream(&mut self) {
        let addr = format!("127.0.0.1:{}", self.wda_port);
        if let Ok(mut device_stream) = TcpStream::connect(&addr).await {
            // 启用 TCP_NODELAY 以减少延迟
            let _ = device_stream.set_nodelay(true);
            
            let request = "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n";
            if device_stream.write_all(request.as_bytes()).await.is_err() {
                return;
            }

            // 使用 1MB 缓冲区以减少系统调用，提升吞吐量
            let mut reader = BufReader::with_capacity(1024 * 1024, device_stream);
            
            // 消耗掉初始 HTTP 响应头
            let mut line = String::new();
            loop {
                line.clear();
                if reader.read_line(&mut line).await.unwrap_or(0) == 0 { return; }
                if line == "\r\n" || line == "\n" { break; }
            }

            let mut frame_count = 0u64;
            
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
                                frame_count += 1;
                                
                                // 定期打印统计信息 (已由用户调优：静默模式)
                                /*
                                if frame_count % 100 == 0 {
                                    let elapsed = start_time.elapsed().as_secs_f64();
                                    let fps = frame_count as f64 / elapsed;
                                    println!(">>> [MJPEG] 已接收 {} 帧, 平均 {:.1} FPS", frame_count, fps);
                                }
                                */
                                
                                // 发送到广播通道（如果通道满了会自动丢弃旧帧）
                                let _ = self.tx.send(Arc::new(frame_data));
                            } else {
                                break;
                            }
                        }
                    }
                }
            }
            
            println!(">>> [MJPEG] 流结束，共接收 {} 帧", frame_count);
        }
    }
}
