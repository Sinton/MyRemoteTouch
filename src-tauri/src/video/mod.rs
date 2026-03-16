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

pub mod mjpeg;
pub mod server;
pub mod config;
pub mod traits;
pub mod frame_pool;
