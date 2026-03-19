use std::path::Path;
use std::process::Command;
use tracing::{debug, info, warn};
use crate::clients::WdaClient;
use crate::error::AppResult;
use crate::smart_task::model::Region;
use crate::smart_task::snapshot;

/// OCR 识别结果
#[derive(Debug, Clone)]
pub struct OcrResult {
    /// 识别出的全部文本
    pub text: String,
    /// 置信度 (0.0 ~ 1.0)
    pub confidence: f64,
}

/// 对指定区域执行 OCR 文字识别
///
/// 流程：
/// 1. 通过 WDA /screenshot 抓取当前帧
/// 2. 裁剪指定区域（如果有）
/// 3. 保存到临时 PNG 文件
/// 4. 调用 Tesseract CLI 识别
/// 5. 返回识别文本
pub async fn recognize_text(
    wda: &WdaClient,
    region: Option<&Region>,
) -> AppResult<OcrResult> {
    let frame = snapshot::capture_frame(wda).await?;

    let target = match region {
        Some(r) => snapshot::crop_region(&frame, r)?,
        None => frame,
    };

    let tmp_path = snapshot::save_to_temp(&target, "ocr_input")?;
    let text = run_tesseract(&tmp_path)?;
    let _ = std::fs::remove_file(&tmp_path);

    info!("[OCR] 识别结果: '{}'", text.trim());
    Ok(OcrResult {
        text: text.trim().to_string(),
        confidence: 1.0,
    })
}

/// 调用 Tesseract CLI 进行 OCR 识别
///
/// 需要系统安装 Tesseract：
/// - Windows: `choco install tesseract` 或从 GitHub 下载
/// - macOS:   `brew install tesseract`
/// - Linux:   `apt install tesseract-ocr`
fn run_tesseract(image_path: &Path) -> AppResult<String> {
    debug!("[OCR] 调用 Tesseract: {:?}", image_path);

    let result = Command::new("tesseract")
        .arg(image_path.to_string_lossy().to_string())
        .arg("stdout")
        .arg("-l").arg("chi_sim+eng")
        .arg("--psm").arg("6")
        .output();

    match result {
        Ok(output) => {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).to_string();
                debug!("[OCR] Tesseract 输出: '{}'", text.trim());
                Ok(text)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                warn!("[OCR] Tesseract 返回错误: {}", stderr);
                Ok(String::new())
            }
        }
        Err(e) => {
            warn!(
                "[OCR] Tesseract 未安装或不可用: {}。请安装以启用 OCR 功能。",
                e
            );
            Ok(String::new())
        }
    }
}

/// 快速检查 Tesseract 是否可用
pub fn is_tesseract_available() -> bool {
    Command::new("tesseract")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
