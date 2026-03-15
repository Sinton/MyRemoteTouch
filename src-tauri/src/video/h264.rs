use tokio::sync::{broadcast, mpsc};
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use crate::video::h264_dvt::H264DvtProvider;

#[derive(Debug, Clone)]
pub enum H264Packet {
    SPS(Vec<u8>),
    PPS(Vec<u8>),
    Data(Vec<u8>),
}

/// H264Provider - 原生 H.264 视频采集模块
pub struct H264Provider {
    tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>,
}

impl H264Provider {
    pub fn new(tx: Arc<broadcast::Sender<Arc<Vec<u8>>>>) -> Self {
        Self { tx }
    }

    pub async fn run(&mut self, token: CancellationToken) {
        println!(">>> [H264] H.264 模块启动...");

        // 统一使用 Scheme D (DVT/RemoteXPC) 方案，该协议跨平台支持良好
        println!(">>> [H264] 尝试初始化 Scheme D (DVT/RemoteXPC) 方案...");
        
        let mux_res = idevice::usbmuxd::UsbmuxdConnection::default().await;
        if let Ok(mut mux) = mux_res {
            if let Ok(devices) = mux.get_devices().await {
                if let Some(dev) = devices.first() {
                    let (h264_tx, mut h264_rx) = mpsc::channel::<H264Packet>(100);
                    let provider = H264DvtProvider::new(dev.udid.clone(), h264_tx);
                    let video_tx = Arc::clone(&self.tx);
                    
                    tokio::spawn(async move {
                        if let Err(e) = provider.run().await {
                            println!(">>> [H264-DVT] 运行失败: {}", e);
                        }
                    });

                    // 转换 H264Packet 为广播流
                    let h264_token = token.clone();
                    tokio::spawn(async move {
                        tokio::select! {
                            _ = h264_token.cancelled() => {}
                            _ = async {
                                while let Some(packet) = h264_rx.recv().await {
                                    match packet {
                                        H264Packet::Data(data) => {
                                            let _ = video_tx.send(Arc::new(data));
                                        }
                                        _ => {}
                                    }
                                }
                            } => {}
                        }
                    });

                    // 保持主任务运行直到 token 取消
                    token.cancelled().await;
                    return;
                }
            }
        }

        println!(">>> [H264] 未找到可用设备或初始化失败。");
        token.cancelled().await;
    }
}
