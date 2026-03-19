use regex::Regex;
use serde::Serialize;
use tracing::{debug, info, warn};
use crate::clients::WdaClient;
use crate::error::{AppError, AppResult};
use crate::smart_task::model::Selector;
use crate::smart_task::{ocr, template_matcher};

/// 选择器命中结果
#[derive(Debug, Clone, Serialize)]
pub struct ResolveResult {
    /// 元素中心 PT 坐标
    pub center_x: f64,
    pub center_y: f64,
    /// 元素矩形 PT
    pub rect_x: f64,
    pub rect_y: f64,
    pub rect_w: f64,
    pub rect_h: f64,
    /// 匹配到的文本内容（label / OCR 文本）
    pub matched_text: String,
}

/// 混合选择器：按类型分发，WDA Label → Predicate → OCR → TemplateIcon
///
/// - WdaLabel / WdaPredicate: 使用 WDA find_element + get_element_rect
/// - OcrText: 截图 → Tesseract → 在全屏 UI 树中搜索匹配文本的元素
/// - TemplateIcon: 截图 → NCC 模板匹配 → 返回匹配区域中心坐标
pub async fn resolve(
    wda: &WdaClient,
    selector: &Selector,
    device_w: f64,
    device_h: f64,
) -> AppResult<ResolveResult> {
    match selector {
        Selector::WdaLabel { value } => resolve_by_label(wda, value).await,
        Selector::WdaPredicate { value } => resolve_by_predicate(wda, value).await,
        Selector::OcrText { value, region } => {
            resolve_by_ocr(wda, value, region.as_ref(), device_w, device_h).await
        }
        Selector::TemplateIcon { icon_id, region } => {
            resolve_by_template(wda, icon_id, region.as_ref(), device_w, device_h).await
        }
    }
}

/// WDA Label 匹配（优先精确，失败则尝试模糊包含）
async fn resolve_by_label(wda: &WdaClient, label: &str) -> AppResult<ResolveResult> {
    debug!("[Selector] 尝试 WDA Label: '{}'", label);
    
    // 1. 尝试精确查找
    match wda.find_element_by_label(label).await {
        Ok(element_id) => {
            element_to_result(wda, &element_id, label.to_string()).await
        }
        Err(_) => {
            // 2. 失败则降级为模糊包含匹配 (Predicate)
            debug!("[Selector] 精确匹配失败，尝试模糊包含: '{}'", label);
            let predicate = format!("label CONTAINS '{}'", label);
            resolve_by_predicate(wda, &predicate).await
        }
    }
}

/// WDA Predicate 匹配
async fn resolve_by_predicate(wda: &WdaClient, predicate: &str) -> AppResult<ResolveResult> {
    debug!("[Selector] 尝试 WDA Predicate: '{}'", predicate);
    let element_id = wda.find_element("predicate string", predicate).await?;
    element_to_result(wda, &element_id, predicate.to_string()).await
}

/// OCR 文本匹配
///
/// 策略：
/// 1. 截图 + 区域裁剪 + Tesseract OCR
/// 2. 用 OCR 识别到的文本去 WDA UI 树中 label CONTAINS 搜索
/// 3. 如果 Tesseract 不可用，直接降级为 WDA predicate 搜索
async fn resolve_by_ocr(
    wda: &WdaClient,
    expected_text: &str,
    region: Option<&crate::smart_task::model::Region>,
    _device_w: f64,
    _device_h: f64,
) -> AppResult<ResolveResult> {
    debug!("[Selector] OCR 模式: 搜索文本 '{}'", expected_text);

    if !ocr::is_tesseract_available() {
        warn!("[Selector] Tesseract 不可用，降级为 WDA predicate");
        let predicate = format!("label CONTAINS '{}'", expected_text);
        return resolve_by_predicate(wda, &predicate).await;
    }

    // Step 1: OCR 识别
    let ocr_result = ocr::recognize_text(wda, region).await?;

    // Step 2: 验证 OCR 结果是否包含目标文本
    if !ocr_result.text.contains(expected_text) {
        // OCR 未找到目标文本 → 降级为 WDA predicate
        warn!(
            "[Selector] OCR 未匹配 '{}' (识别内容: '{}'), 降级 WDA",
            expected_text, ocr_result.text
        );
        let predicate = format!("label CONTAINS '{}'", expected_text);
        return resolve_by_predicate(wda, &predicate).await;
    }

    // Step 3: OCR 成功 → 用文本去 WDA 搜索对应元素的坐标
    info!("[Selector] OCR 验证通过: '{}' in '{}'", expected_text, ocr_result.text);
    let predicate = format!("label CONTAINS '{}'", expected_text);
    resolve_by_predicate(wda, &predicate).await
}

/// 模板图标匹配
///
/// 使用 NCC 算法在屏幕截图中搜索模板图片的位置
async fn resolve_by_template(
    wda: &WdaClient,
    icon_id: &str,
    region: Option<&crate::smart_task::model::Region>,
    device_w: f64,
    device_h: f64,
) -> AppResult<ResolveResult> {
    debug!("[Selector] Template 模式: icon_id='{}'", icon_id);

    // icon_id 即模板图片路径（相对于 ~/.myremotetouch/templates/ 或绝对路径）
    let template_path = resolve_template_path(icon_id)?;

    let result = template_matcher::find_template(
        wda,
        &template_path,
        region,
        0.85, // 相似度阈值
        device_w,
        device_h,
    )
    .await?;

    match result {
        Some(m) => {
            info!(
                "[Selector] 模板匹配成功: center=({:.1}, {:.1}), sim={:.3}",
                m.center_x, m.center_y, m.similarity
            );
            Ok(ResolveResult {
                center_x: m.center_x,
                center_y: m.center_y,
                rect_x: m.x_pct * device_w,
                rect_y: m.y_pct * device_h,
                rect_w: m.w_pct * device_w,
                rect_h: m.h_pct * device_h,
                matched_text: format!("[template:{}]", icon_id),
            })
        }
        None => Err(AppError::Wda(format!(
            "模板 '{}' 在屏幕中未找到匹配 (阈值 0.85)",
            icon_id
        ))),
    }
}

/// 解析模板路径：支持绝对路径或相对于 templates 目录
fn resolve_template_path(icon_id: &str) -> AppResult<String> {
    let path = std::path::Path::new(icon_id);
    if path.is_absolute() && path.exists() {
        return Ok(icon_id.to_string());
    }

    // 尝试在 ~/.myremotetouch/templates/ 中查找
    let base = dirs::home_dir()
        .ok_or_else(|| AppError::Config("无法获取 Home 目录".to_string()))?;
    let templates_dir = base.join(".myremotetouch").join("templates");
    let full_path = templates_dir.join(icon_id);

    if full_path.exists() {
        Ok(full_path.to_string_lossy().to_string())
    } else {
        Err(AppError::Wda(format!(
            "模板文件未找到: '{}' (搜索路径: {:?})",
            icon_id, templates_dir
        )))
    }
}

/// 将元素 ID 转换为包含中心坐标的 ResolveResult
async fn element_to_result(
    wda: &WdaClient,
    element_id: &str,
    matched_text: String,
) -> AppResult<ResolveResult> {
    let rect = wda.get_element_rect(element_id).await?;
    let x = rect["x"].as_f64().unwrap_or(0.0);
    let y = rect["y"].as_f64().unwrap_or(0.0);
    let w = rect["width"].as_f64().unwrap_or(0.0);
    let h = rect["height"].as_f64().unwrap_or(0.0);

    // 获取真实的 Label 文本内容，而不是使用搜索时的关键词
    let real_label = wda.get_element_label(element_id).await.unwrap_or(matched_text);

    info!(
        "[Selector] 命中元素: rect=({:.0}, {:.0}, {:.0}, {:.0}), text='{}'",
        x, y, w, h, real_label
    );

    Ok(ResolveResult {
        center_x: x + w / 2.0,
        center_y: y + h / 2.0,
        rect_x: x,
        rect_y: y,
        rect_w: w,
        rect_h: h,
        matched_text: real_label,
    })
}

/// 变量提取器：从匹配文本中提取数字，供 SmartSleep 使用
///
/// `pattern` 如 `$1` 表示取第 1 个数字；`$2` 取第 2 个。
pub fn extract_number(text: &str, pattern: &str) -> Option<u64> {
    let re = Regex::new(r"\d+").ok()?;
    let index: usize = pattern
        .trim_start_matches('$')
        .parse()
        .unwrap_or(1)
        .max(1)
        - 1;

    let result = re.find_iter(text)
                   .nth(index)
                   .and_then(|m| m.as_str().parse::<u64>().ok());
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_number_basic() {
        assert_eq!(extract_number("还剩 30 秒", "$1"), Some(30));
        assert_eq!(extract_number("第 3 轮, 还剩 15 秒", "$2"), Some(15));
        assert_eq!(extract_number("没有数字", "$1"), None);
    }
}
