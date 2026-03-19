use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};
use crate::clients::WdaClient;
use crate::error::{AppError, AppResult};
use crate::smart_task::{
    inspector::{self, InspectResult},
    model::Task,
    persistence,
    runner::{RunnerEvent, TaskRunner},
};

/// 元素检查请求参数
#[derive(Debug, Deserialize)]
pub struct InspectRequest {
    pub x_pct: f64,
    pub y_pct: f64,
    pub device_w: f64,
    pub device_h: f64,
}

/// 检查元素：根据百分比坐标在 WDA UI 树中找到对应元素
#[tauri::command]
pub async fn inspect_element(
    wda: tauri::State<'_, Arc<WdaClient>>,
    x_pct: f64,
    y_pct: f64,
    device_w: f64,
    device_h: f64,
) -> AppResult<Option<InspectResult>> {
    info!("[SmartTask] 检查元素: ({:.3}, {:.3})", x_pct, y_pct);
    inspector::inspect_at(&wda, x_pct, y_pct, device_w, device_h).await
}

/// 保存任务到本地文件
#[tauri::command]
pub fn save_task(task: Task) -> AppResult<()> {
    info!("[SmartTask] 保存任务: {} ({})", task.name, task.task_id);
    persistence::save_task(&task)
}

/// 加载所有保存的任务
#[tauri::command]
pub fn load_tasks() -> AppResult<Vec<Task>> {
    info!("[SmartTask] 加载所有任务...");
    persistence::load_all_tasks()
}

/// 删除指定任务
#[tauri::command]
pub fn delete_task(task_id: String) -> AppResult<()> {
    info!("[SmartTask] 删除任务: {}", task_id);
    persistence::delete_task(&task_id)
}

/// 获取任务存储目录路径（供前端展示）
#[derive(Serialize)]
pub struct TaskStorageInfo {
    pub path: String,
}

#[tauri::command]
pub fn get_task_storage_dir() -> AppResult<TaskStorageInfo> {
    let base = dirs::home_dir()
        .ok_or_else(|| AppError::Config("无法获取 Home 目录".to_string()))?;
    let dir = base.join(".myremotetouch").join("tasks");
    Ok(TaskStorageInfo {
        path: dir.to_string_lossy().to_string(),
    })
}

/// 启动任务执行器
///
/// 在 tokio 后台任务中运行 TaskRunner，通过 Tauri Event 推送进度。
/// 返回后前端通过 `smart_task:progress` 事件接收实时状态。
#[tauri::command]
pub async fn start_task_runner(
    app: tauri::AppHandle,
    wda: tauri::State<'_, Arc<WdaClient>>,
    cancel: tauri::State<'_, Arc<CancellationToken>>,
    task: Task,
    device_w: f64,
    device_h: f64,
) -> AppResult<()> {
    info!("[SmartTask] 启动任务执行器: {} ({})", task.name, task.task_id);

    let wda = Arc::clone(&wda);
    let cancel_child = cancel.child_token();

    let runner = TaskRunner::new(
        wda,
        task,
        cancel_child,
        device_w,
        device_h,
    );

    let app_handle = app.clone();
    tokio::spawn(async move {
        let emit = |event: RunnerEvent| {
            if let Err(e) = app_handle.emit("smart_task:progress", &event) {
                error!("[SmartTask] 事件推送失败: {}", e);
            }
        };

        match runner.run(emit).await {
            Ok(()) => info!("[SmartTask] 任务执行器正常退出"),
            Err(e) => error!("[SmartTask] 任务执行器异常: {}", e),
        }
    });

    Ok(())
}

/// 急停：取消正在运行的任务
#[tauri::command]
pub async fn stop_task_runner(
    cancel: tauri::State<'_, Arc<CancellationToken>>,
) -> AppResult<()> {
    info!("[SmartTask] 急停：取消任务执行");
    cancel.cancel();
    Ok(())
}
