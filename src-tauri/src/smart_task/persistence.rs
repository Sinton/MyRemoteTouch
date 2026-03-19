use std::fs;
use std::path::PathBuf;
use serde_json;
use tracing::{info, warn};
use crate::error::{AppError, AppResult};
use crate::smart_task::model::Task;

/// 返回任务存储目录（~/.myremotetouch/tasks/）
fn tasks_dir() -> AppResult<PathBuf> {
    let base = dirs::home_dir()
        .ok_or_else(|| AppError::Config("无法获取 Home 目录".to_string()))?;
    let dir = base.join(".myremotetouch").join("tasks");
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| AppError::Io(e))?;
    }
    Ok(dir)
}

/// 将任务序列化为 JSON 并写入本地文件
pub fn save_task(task: &Task) -> AppResult<()> {
    let dir = tasks_dir()?;
    let file_path = dir.join(format!("{}.json", task.task_id));
    let json = serde_json::to_string_pretty(task)?;
    fs::write(&file_path, json)
        .map_err(|e| AppError::Io(e))?;
    info!("[SmartTask] 任务已保存: {}", file_path.display());
    Ok(())
}

/// 删除指定任务文件
pub fn delete_task(task_id: &str) -> AppResult<()> {
    let dir = tasks_dir()?;
    let file_path = dir.join(format!("{}.json", task_id));
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| AppError::Io(e))?;
        info!("[SmartTask] 任务已删除: {}", task_id);
    }
    Ok(())
}

/// 加载目录中所有任务文件
pub fn load_all_tasks() -> AppResult<Vec<Task>> {
    let dir = tasks_dir()?;
    let mut tasks = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| AppError::Io(e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            match fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<Task>(&content) {
                    Ok(task) => tasks.push(task),
                    Err(e) => warn!("[SmartTask] 解析任务文件失败 {:?}: {}", path, e),
                },
                Err(e) => warn!("[SmartTask] 读取任务文件失败 {:?}: {}", path, e),
            }
        }
    }

    info!("[SmartTask] 共加载 {} 个任务", tasks.len());
    Ok(tasks)
}
