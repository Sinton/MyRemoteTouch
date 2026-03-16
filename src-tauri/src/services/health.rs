use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use tracing::{warn, error, info, debug};
use crate::clients::WdaClient;
use crate::config::HealthConfig;

/// 健康状态
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

/// 健康检查统计
#[derive(Debug, Clone)]
pub struct HealthStats {
    pub total_checks: u64,
    pub failed_checks: u64,
    pub consecutive_failures: u32,
    pub last_success_time: Option<std::time::Instant>,
    pub last_failure_time: Option<std::time::Instant>,
}

impl HealthStats {
    fn new() -> Self {
        Self {
            total_checks: 0,
            failed_checks: 0,
            consecutive_failures: 0,
            last_success_time: None,
            last_failure_time: None,
        }
    }

    fn record_success(&mut self) {
        self.total_checks += 1;
        self.consecutive_failures = 0;
        self.last_success_time = Some(std::time::Instant::now());
    }

    fn record_failure(&mut self) {
        self.total_checks += 1;
        self.failed_checks += 1;
        self.consecutive_failures += 1;
        self.last_failure_time = Some(std::time::Instant::now());
    }

    fn success_rate(&self) -> f64 {
        if self.total_checks == 0 {
            return 1.0;
        }
        (self.total_checks - self.failed_checks) as f64 / self.total_checks as f64
    }
}

use crate::services::device::DeviceManager;

/// 健康检查服务
pub struct HealthService {
    wda_client: Arc<WdaClient>,
    device_manager: Arc<DeviceManager>,
    config: HealthConfig,
    stats: Arc<tokio::sync::RwLock<HealthStats>>,
}

impl HealthService {
    pub fn new(wda_client: Arc<WdaClient>, device_manager: Arc<DeviceManager>, config: HealthConfig) -> Self {
        Self {
            wda_client,
            device_manager,
            config,
            stats: Arc::new(tokio::sync::RwLock::new(HealthStats::new())),
        }
    }

    /// 获取当前健康状态
    #[allow(dead_code)]
    pub async fn get_status(&self) -> HealthStatus {
        let stats = self.stats.read().await;
        
        if stats.consecutive_failures == 0 {
            HealthStatus::Healthy
        } else if stats.consecutive_failures < 3 {
            HealthStatus::Degraded
        } else {
            HealthStatus::Unhealthy
        }
    }

    /// 获取健康统计
    #[allow(dead_code)]
    pub async fn get_stats(&self) -> HealthStats {
        self.stats.read().await.clone()
    }

    /// 执行单次健康检查
    async fn perform_check(&self) -> bool {
        match self.wda_client.check_health().await {
            Ok(_) => {
                let mut stats = self.stats.write().await;
                stats.record_success();
                
                if stats.consecutive_failures > 0 {
                    info!("WDA 连接已恢复");
                }
                true
            }
            Err(e) => {
                let mut stats = self.stats.write().await;
                stats.record_failure();
                
                warn!(
                    "WDA 健康检查失败 (连续失败: {}): {}", 
                    stats.consecutive_failures, 
                    e
                );
                false
            }
        }
    }

    /// 启动健康检查服务（带重试机制）
    pub async fn start(self, token: CancellationToken) {
        info!("健康检查服务正在等待设备扫描就绪...");
        self.device_manager.wait_for_ready().await;
        info!("设备已就绪，开始执行定期健康检查");

        let mut interval = tokio::time::interval(self.config.check_interval());
        let max_retries = 3;
        
        info!("健康检查服务已启动，间隔: {:?}", self.config.check_interval());
        
        loop {
            tokio::select! {
                _ = token.cancelled() => {
                    info!("健康检查服务正在关闭");
                    self.print_final_stats().await;
                    break;
                }
                _ = interval.tick() => {
                    let success = self.perform_check().await;
                    
                    if !success {
                        // 失败后进行重试
                        for retry in 1..=max_retries {
                            debug!("重试健康检查 ({}/{})", retry, max_retries);
                            tokio::time::sleep(self.config.retry_delay()).await;
                            
                            if self.perform_check().await {
                                break;
                            }
                        }
                        
                        // 检查是否达到严重失败阈值
                        let stats = self.stats.read().await;
                        if stats.consecutive_failures >= 5 {
                            error!(
                                "WDA 连接严重异常 (连续失败 {} 次，成功率: {:.1}%)",
                                stats.consecutive_failures,
                                stats.success_rate() * 100.0
                            );
                        }
                    }
                    
                    // 定期打印统计信息
                    self.maybe_print_stats().await;
                }
            }
        }
    }

    /// 定期打印统计信息（每 100 次检查）
    async fn maybe_print_stats(&self) {
        let stats = self.stats.read().await;
        if stats.total_checks % 100 == 0 && stats.total_checks > 0 {
            info!(
                "健康检查统计 - 总计: {}, 失败: {}, 成功率: {:.1}%",
                stats.total_checks,
                stats.failed_checks,
                stats.success_rate() * 100.0
            );
        }
    }

    /// 打印最终统计信息
    async fn print_final_stats(&self) {
        let stats = self.stats.read().await;
        info!(
            "健康检查服务已停止 - 总计: {}, 失败: {}, 成功率: {:.1}%",
            stats.total_checks,
            stats.failed_checks,
            stats.success_rate() * 100.0
        );
    }
}
