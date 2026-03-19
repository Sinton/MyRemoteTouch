use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use rand::Rng;
use serde::Serialize;
use tokio::time::sleep;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};
use crate::clients::WdaClient;
use crate::error::{AppError, AppResult};
use crate::smart_task::hybrid_selector;
use crate::smart_task::model::{Action, FailurePolicy, Step, SuccessRoute, Task};
use crate::gestures::{GestureFactory, GestureStrategy};

/// 执行引擎状态（推送给前端的 Tauri Event payload）
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum RunnerEvent {
    /// 正在扫描/识别元素
    Scanning {
        step_id: String,
        step_name: String,
    },
    /// 正在执行动作
    Executing {
        step_id: String,
        action_desc: String,
        tap_x: Option<f64>,
        tap_y: Option<f64>,
    },
    /// 正在休眠
    Sleeping {
        step_id: String,
        remaining_secs: u64,
    },
    /// 任务完成
    Finished {
        total_steps: usize,
        elapsed_secs: u64,
    },
    /// 任务失败
    Failed {
        step_id: String,
        reason: String,
    },
    /// 任务被用户中止
    Cancelled,
}

/// 任务执行器
///
/// 基于 tokio 异步状态机，按 DSL 步骤链逐步执行。
/// 支持急停（CancellationToken）、human-like 随机延迟、变量提取。
pub struct TaskRunner {
    wda: Arc<WdaClient>,
    task: Task,
    cancel: CancellationToken,
    device_w: f64,
    device_h: f64,
}

impl TaskRunner {
    pub fn new(
        wda: Arc<WdaClient>,
        task: Task,
        cancel: CancellationToken,
        device_w: f64,
        device_h: f64,
    ) -> Self {
        Self { wda, task, cancel, device_w, device_h }
    }

    /// 主执行循环
    ///
    /// `emit_fn`: 接收 RunnerEvent 的回调（由 Tauri command 层传入 app_handle.emit）
    pub async fn run<F>(&self, emit_fn: F) -> AppResult<()>
    where
        F: Fn(RunnerEvent) + Send + Sync,
    {
        let start = Instant::now();
        let global_deadline = start + Duration::from_secs(self.task.global_timeout_secs);

        // 构建 step lookup map
        let step_map: HashMap<&str, &Step> = self.task
                                                  .steps
                                                  .iter()
                                                  .map(|s| (s.id.as_str(), s))
                                                  .collect();

        let mut current_id = self.task.entry.as_str();
        let mut executed_count: usize = 0;
        let mut loop_count: u32 = 0;

        loop {
            // ── 急停检查 ─────────────────────────────────────────────
            if self.cancel.is_cancelled() {
                info!("[Runner] 任务被用户中止");
                emit_fn(RunnerEvent::Cancelled);
                return Ok(());
            }

            // ── 全局超时 ────────────────────────────────────────────
            if Instant::now() > global_deadline {
                let msg = format!("全局超时 ({}s)", self.task.global_timeout_secs);
                error!("[Runner] {}", msg);
                emit_fn(RunnerEvent::Failed {
                    step_id: current_id.to_string(),
                    reason: msg.clone(),
                });
                return Err(AppError::Wda(msg));
            }

            // ── v2.1: 循环保护 ──────────────────────────────────────
            if self.task.max_loop_count > 0 && loop_count >= self.task.max_loop_count {
                let msg = format!("已达最大循环次数 ({})", self.task.max_loop_count);
                info!("[Runner] {}", msg);
                emit_fn(RunnerEvent::Finished {
                    total_steps: executed_count,
                    elapsed_secs: start.elapsed().as_secs(),
                });
                return Ok(());
            }

            // ── 查找当前步骤 ────────────────────────────────────────
            let step = match step_map.get(current_id) {
                Some(s) => *s,
                None => {
                    let msg = format!("步骤 '{}' 不存在于任务定义中", current_id);
                    error!("[Runner] {}", msg);
                    emit_fn(RunnerEvent::Failed {
                        step_id: current_id.to_string(),
                        reason: msg.clone(),
                    });
                    return Err(AppError::Wda(msg));
                }
            };

            info!("[Runner] ▶ 步骤 #{}: {} ({})", executed_count + 1, step.name, step.id);

            // ── pre_delay（含 human-like 随机抖动）───────────────────
            let jitter = self.human_jitter();
            let pre_wait = Duration::from_millis(step.pre_delay_ms + jitter);
            if !pre_wait.is_zero() {
                debug!("[Runner]   ⏳ pre_delay {}ms (含抖动 {}ms)", pre_wait.as_millis(), jitter);
                self.cancellable_sleep(pre_wait).await?;
            }

            // ── 扫描阶段：识别元素 ─────────────────────────────────
            emit_fn(RunnerEvent::Scanning {
                step_id: step.id.clone(),
                step_name: step.name.clone(),
            });

            let resolve_result = self.scan_with_timeout(step).await;

            match resolve_result {
                Ok(hit) => {
                    // ── 执行动作 ────────────────────────────────────
                    match &step.action {
                        Action::Tap { offset_x, offset_y } => {
                            // ── v2.1: 智能坐标换算 ──────────────────────────
                            // 如果 offset 是 0.0-1.0 之间的值，认为它是录制得到的绝对百分比坐标
                            // 如果 offset > 1.0 或为 0，且有探测到元素，则作为元素中心点的相对偏移
                            let target_x = if *offset_x > 0.0 && *offset_x <= 1.0 {
                                self.device_w * (*offset_x)
                            } else {
                                hit.center_x + (*offset_x)
                            };

                            let target_y = if *offset_y > 0.0 && *offset_y <= 1.0 {
                                self.device_h * (*offset_y)
                            } else {
                                hit.center_y + (*offset_y)
                            };

                            let (tx, ty) = self.humanized_tap(target_x, target_y);
                            
                            emit_fn(RunnerEvent::Executing {
                                step_id: step.id.clone(),
                                action_desc: format!("点击位置 ({:.0}, {:.0})", tx, ty),
                                tap_x: Some(tx),
                                tap_y: Some(ty),
                            });
                            self.do_tap(tx, ty).await?;
                        }
                        Action::SmartSleep { variable, fallback_secs, early_wake_secs } => {
                            let extracted = hybrid_selector::extract_number(
                                &hit.matched_text,
                                variable,
                            )
                            .unwrap_or(*fallback_secs);

                            // v2.1: 提前唤醒
                            let wake = early_wake_secs.unwrap_or(0);
                            let actual_sleep = if extracted > wake { extracted - wake } else { 0 };

                            info!(
                                "[Runner]   💤 SmartSleep: {}s (提取={}, 提前唤醒={}s, 实际休眠={}s)",
                                extracted, hit.matched_text, wake, actual_sleep
                            );
                            emit_fn(RunnerEvent::Sleeping {
                                step_id: step.id.clone(),
                                remaining_secs: actual_sleep,
                            });
                            self.cancellable_sleep(Duration::from_secs(actual_sleep)).await?;
                        }
                        Action::Finish => {
                            info!("[Runner]   🏁 Finish action — 任务正常结束");
                            executed_count += 1;
                            emit_fn(RunnerEvent::Finished {
                                total_steps: executed_count,
                                elapsed_secs: start.elapsed().as_secs(),
                            });
                            return Ok(());
                        }
                    }

                    executed_count += 1;

                    // ── post_delay ──────────────────────────────────
                    let post_wait = Duration::from_millis(step.post_delay_ms + self.human_jitter());
                    if !post_wait.is_zero() {
                        debug!("[Runner]   ⏳ post_delay {}ms", post_wait.as_millis());
                        self.cancellable_sleep(post_wait).await?;
                    }

                    // ── v2.1: 跳转路由 (支持条件分叉) ────────────────
                    match &step.on_success {
                        SuccessRoute::Next { step_id } => {
                            if step_id.is_empty() {
                                // step_id 为空 → 自动跳到下一个相邻步骤
                                let current_idx = self.task.steps.iter().position(|s| s.id == step.id);
                                match current_idx {
                                    Some(idx) if idx + 1 < self.task.steps.len() => {
                                        let next = &self.task.steps[idx + 1];
                                        info!("[Runner]   ➡ 自动跳至下一步: {} ({})", next.name, next.id);
                                        current_id = next.id.as_str();
                                    }
                                    _ => {
                                        // 已经是最后一步 → 自动结束
                                        info!("[Runner]   🏁 已是最后一步，自动结束任务");
                                        emit_fn(RunnerEvent::Finished {
                                            total_steps: executed_count,
                                            elapsed_secs: start.elapsed().as_secs(),
                                        });
                                        return Ok(());
                                    }
                                }
                            } else {
                                current_id = self.task
                                                 .steps
                                                 .iter()
                                                 .find(|s| s.id == *step_id)
                                                 .map(|s| s.id.as_str())
                                                 .unwrap_or(step_id.as_str());
                            }
                        }
                        SuccessRoute::ConditionalRoute { routes, default } => {
                            let matched_text = &hit.matched_text;
                            let target = routes
                                .iter()
                                .find(|r| matched_text.contains(&r.text_contains))
                                .map(|r| r.goto_step.as_str())
                                .unwrap_or(default.as_str());

                            info!(
                                "[Runner]   🔀 条件路由: matched='{}' → 跳转到 '{}'",
                                matched_text, target
                            );
                            loop_count += 1; // 条件路由通常意味着循环，计数
                            current_id = self.task
                                             .steps
                                             .iter()
                                             .find(|s| s.id == target)
                                             .map(|s| s.id.as_str())
                                             .unwrap_or(target);
                        }
                        SuccessRoute::Finish => {
                            emit_fn(RunnerEvent::Finished {
                                total_steps: executed_count,
                                elapsed_secs: start.elapsed().as_secs(),
                            });
                            return Ok(());
                        }
                    }
                }
                Err(scan_err) => {
                    // ── 识别失败 → 应用 failure_policy ──────────────
                    warn!("[Runner]   ❌ 识别失败: {}", scan_err);
                    match &step.on_failure {
                        FailurePolicy::Retry => {
                            warn!("[Runner]   🔄 重试当前步骤...");
                            // current_id 不变，继续循环即可
                            self.cancellable_sleep(Duration::from_millis(1000)).await?;
                        }
                        FailurePolicy::GotoStep(target_id) => {
                            info!("[Runner]   ↩ 跳转到步骤 '{}'", target_id);
                            current_id = self.task
                                             .steps
                                             .iter()
                                             .find(|s| s.id == *target_id)
                                             .map(|s| s.id.as_str())
                                             .unwrap_or(target_id.as_str());
                        }
                        FailurePolicy::Abort => {
                            let msg = format!("步骤 '{}' 识别失败且策略为 Abort", step.id);
                            error!("[Runner]   🛑 {}", msg);
                            emit_fn(RunnerEvent::Failed {
                                step_id: step.id.clone(),
                                reason: msg.clone(),
                            });
                            return Err(AppError::Wda(msg));
                        }
                    }
                }
            }
        }
    }

    // ─── 内部工具函数 ──────────────────────────────────────────────────────────

    /// 在超时范围内重复尝试识别元素
    async fn scan_with_timeout(
        &self,
        step: &Step,
    ) -> AppResult<hybrid_selector::ResolveResult> {
        let deadline = Instant::now() + Duration::from_millis(step.timeout_ms);
        let poll_interval = Duration::from_millis(800);
        let mut attempt = 0u32;

        loop {
            attempt += 1;
            if self.cancel.is_cancelled() {
                return Err(AppError::Wda("任务已取消".to_string()));
            }
            if Instant::now() > deadline {
                return Err(AppError::Wda(
                    format!("步骤 '{}' 识别超时 ({}ms)", step.id, step.timeout_ms),
                ));
            }

            match hybrid_selector::resolve(&self.wda, &step.selector, self.device_w, self.device_h).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    debug!("[Runner]   扫描第 {} 次未命中: {}", attempt, e);
                    self.cancellable_sleep(poll_interval).await?;
                }
            }
        }
    }

    /// 执行 WDA Tap (使用 GestureFactory 保证兼容性)
    async fn do_tap(&self, x: f64, y: f64) -> AppResult<()> {
        info!("[Runner]   ⚡ 正在执行点击: ({:.1}, {:.1})", x, y);
        let gesture = GestureFactory::create_tap(GestureStrategy::Auto);
        gesture.tap(&self.wda, x, y).await
    }

    /// Human-like 随机坐标偏移（±3px 抖动）
    fn humanized_tap(&self, x: f64, y: f64) -> (f64, f64) {
        let mut rng = rand::rng();
        let dx: f64 = rng.random_range(-3.0..3.0);
        let dy: f64 = rng.random_range(-3.0..3.0);
        (x + dx, y + dy)
    }

    /// Human-like 随机延时抖动（在 task.human_delay_range 范围内）
    fn human_jitter(&self) -> u64 {
        let (lo, hi) = self.task.human_delay_range;
        if hi <= lo { return lo; }
        let mut rng = rand::rng();
        rng.random_range(lo..=hi)
    }

    /// 可取消的休眠：支持 CancellationToken 急停
    async fn cancellable_sleep(&self, duration: Duration) -> AppResult<()> {
        tokio::select! {
            _ = sleep(duration) => Ok(()),
            _ = self.cancel.cancelled() => {
                info!("[Runner] 休眠被急停中断");
                Err(AppError::Wda("任务已取消".to_string()))
            }
        }
    }
}
