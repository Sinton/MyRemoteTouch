use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::debug;

/// 帧缓冲池 - 复用内存以减少分配
#[allow(dead_code)]
pub struct FramePool {
    pool: Arc<Mutex<Vec<Vec<u8>>>>,
    max_size: usize,
    buffer_capacity: usize,
}

#[allow(dead_code)]
impl FramePool {
    /// 创建新的帧缓冲池
    /// 
    /// # 参数
    /// - `max_size`: 池中最多保留的缓冲区数量
    /// - `buffer_capacity`: 每个缓冲区的初始容量（字节）
    pub fn new(max_size: usize, buffer_capacity: usize) -> Self {
        Self {
            pool: Arc::new(Mutex::new(Vec::with_capacity(max_size))),
            max_size,
            buffer_capacity,
        }
    }

    /// 从池中获取一个缓冲区
    /// 如果池为空，创建新的缓冲区
    pub async fn acquire(&self) -> Vec<u8> {
        let mut pool = self.pool.lock().await;
        
        if let Some(mut buffer) = pool.pop() {
            buffer.clear();
            debug!("从池中复用缓冲区，池剩余: {}", pool.len());
            buffer
        } else {
            debug!("创建新缓冲区，容量: {}", self.buffer_capacity);
            Vec::with_capacity(self.buffer_capacity)
        }
    }

    /// 将缓冲区归还到池中
    pub async fn release(&self, buffer: Vec<u8>) {
        let mut pool = self.pool.lock().await;
        
        if pool.len() < self.max_size {
            pool.push(buffer);
            debug!("归还缓冲区到池，池大小: {}", pool.len());
        } else {
            debug!("池已满，丢弃缓冲区");
            // 缓冲区会被自动释放
        }
    }

    /// 获取池中当前缓冲区数量
    pub async fn size(&self) -> usize {
        self.pool.lock().await.len()
    }

    /// 清空池
    pub async fn clear(&self) {
        let mut pool = self.pool.lock().await;
        pool.clear();
        debug!("清空帧缓冲池");
    }

    /// 预热池 - 预先分配指定数量的缓冲区
    pub async fn warm_up(&self, count: usize) {
        let mut pool = self.pool.lock().await;
        let to_create = count.min(self.max_size);
        
        for _ in 0..to_create {
            pool.push(Vec::with_capacity(self.buffer_capacity));
        }
        
        debug!("预热帧缓冲池，创建 {} 个缓冲区", to_create);
    }
}

impl Clone for FramePool {
    fn clone(&self) -> Self {
        Self {
            pool: Arc::clone(&self.pool),
            max_size: self.max_size,
            buffer_capacity: self.buffer_capacity,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_frame_pool_basic() {
        let pool = FramePool::new(5, 1024);
        
        // 获取缓冲区
        let buffer1 = pool.acquire().await;
        assert_eq!(buffer1.capacity(), 1024);
        
        // 归还缓冲区
        pool.release(buffer1).await;
        assert_eq!(pool.size().await, 1);
        
        // 再次获取应该复用
        let buffer2 = pool.acquire().await;
        assert_eq!(pool.size().await, 0);
        
        pool.release(buffer2).await;
    }

    #[tokio::test]
    async fn test_frame_pool_max_size() {
        let pool = FramePool::new(2, 1024);
        
        // 归还超过最大数量的缓冲区
        for _ in 0..5 {
            let buffer = pool.acquire().await;
            pool.release(buffer).await;
        }
        
        // 池大小不应超过最大值
        assert_eq!(pool.size().await, 2);
    }

    #[tokio::test]
    async fn test_frame_pool_warm_up() {
        let pool = FramePool::new(10, 1024);
        pool.warm_up(5).await;
        
        assert_eq!(pool.size().await, 5);
    }
}
