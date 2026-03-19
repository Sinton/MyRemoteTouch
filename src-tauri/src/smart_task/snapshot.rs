use image::DynamicImage;
use tracing::{debug, info};
use crate::clients::WdaClient;
use crate::error::{AppError, AppResult};
use crate::smart_task::model::Region;

/// 通过 WDA `/screenshot` 端点抓取当前屏幕快照（Base64 PNG → DynamicImage）
///
/// 这比连接 MJPEG 流更可靠，且每次只取一帧。
pub async fn capture_frame(wda: &WdaClient) -> AppResult<DynamicImage> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/screenshot", sid.as_str()));

    debug!("[Snapshot] 正在从 {} 抓取截图...", url);

    let res = wda.get_dedicated_client()
                 .get(&url)
                 .send()
                 .await?;

    if !res.status().is_success() {
        return Err(AppError::Wda(format!("截图失败: {}", res.status())));
    }

    let body: serde_json::Value = res.json().await?;
    let b64 = body["value"]
        .as_str()
        .ok_or_else(|| AppError::Wda("截图响应缺少 value 字段".to_string()))?;

    use base64::Engine;
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| AppError::Wda(format!("Base64 解码失败: {}", e)))?;

    let img = image::load_from_memory(&png_bytes)
        .map_err(|e| AppError::Wda(format!("图片解码失败: {}", e)))?;

    info!("[Snapshot] 截图成功: {}x{}", img.width(), img.height());
    Ok(img)
}

/// 从全屏帧中裁剪指定区域（百分比坐标）
pub fn crop_region(frame: &DynamicImage, region: &Region) -> AppResult<DynamicImage> {
    let (fw, fh) = (frame.width() as f64, frame.height() as f64);
    let x = (region.x_pct * fw) as u32;
    let y = (region.y_pct * fh) as u32;
    let w = ((region.w_pct * fw) as u32).max(1);
    let h = ((region.h_pct * fh) as u32).max(1);

    // 边界保护
    let x = x.min(frame.width().saturating_sub(1));
    let y = y.min(frame.height().saturating_sub(1));
    let w = w.min(frame.width() - x);
    let h = h.min(frame.height() - y);

    debug!("[Snapshot] 裁剪区域: ({}, {}, {}, {})", x, y, w, h);
    let cropped = frame.crop_imm(x, y, w, h);
    Ok(cropped)
}

/// 将图片保存到临时文件，返回文件路径
pub fn save_to_temp(img: &DynamicImage, prefix: &str) -> AppResult<std::path::PathBuf> {
    let tmp_dir = std::env::temp_dir().join("myremotetouch");
    std::fs::create_dir_all(&tmp_dir)?;

    let filename = format!("{}_{}.png", prefix, timestamp_ms());
    let path = tmp_dir.join(&filename);

    img.save(&path)
       .map_err(|e| AppError::Wda(format!("保存截图失败: {}", e)))?;

    debug!("[Snapshot] 截图已保存: {:?}", path);
    Ok(path)
}

fn timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
