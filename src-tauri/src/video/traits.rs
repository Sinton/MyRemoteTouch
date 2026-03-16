use std::sync::Arc;
use async_trait::async_trait;
use crate::error::AppResult;

/// 视频帧
#[allow(dead_code)]
pub type Frame = Arc<Vec<u8>>;

/// 视频源 trait - 提供视频帧
#[async_trait]
#[allow(dead_code)]
pub trait VideoSource: Send + Sync {
    /// 获取下一帧
    async fn next_frame(&mut self) -> Option<Frame>;
    
    /// 启动视频源
    async fn start(&mut self) -> AppResult<()>;
    
    /// 停止视频源
    async fn stop(&mut self) -> AppResult<()>;
}

/// 视频接收器 trait - 接收并处理视频帧
#[async_trait]
#[allow(dead_code)]
pub trait VideoSink: Send + Sync {
    /// 发送帧到接收器
    async fn send_frame(&mut self, frame: Frame) -> AppResult<()>;
    
    /// 启动接收器
    async fn start(&mut self) -> AppResult<()>;
    
    /// 停止接收器
    async fn stop(&mut self) -> AppResult<()>;
}

/// 视频流管道 - 连接源和接收器
#[allow(dead_code)]
pub struct VideoPipeline {
    source: Box<dyn VideoSource>,
    sinks: Vec<Box<dyn VideoSink>>,
}

#[allow(dead_code)]
impl VideoPipeline {
    pub fn new(source: Box<dyn VideoSource>) -> Self {
        Self {
            source,
            sinks: Vec::new(),
        }
    }
    
    pub fn add_sink(&mut self, sink: Box<dyn VideoSink>) {
        self.sinks.push(sink);
    }
    
    pub async fn start(&mut self) -> AppResult<()> {
        self.source.start().await?;
        for sink in &mut self.sinks {
            sink.start().await?;
        }
        Ok(())
    }
    
    pub async fn run(&mut self) -> AppResult<()> {
        while let Some(frame) = self.source.next_frame().await {
            for sink in &mut self.sinks {
                let _ = sink.send_frame(Arc::clone(&frame)).await;
            }
        }
        Ok(())
    }
    
    pub async fn stop(&mut self) -> AppResult<()> {
        self.source.stop().await?;
        for sink in &mut self.sinks {
            sink.stop().await?;
        }
        Ok(())
    }
}
