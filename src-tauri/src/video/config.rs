use std::sync::atomic::{AtomicU32, Ordering};

pub static VIDEO_FPS: AtomicU32 = AtomicU32::new(60);

pub fn set_video_fps(fps: u32) {
    VIDEO_FPS.store(fps, Ordering::SeqCst);
}
