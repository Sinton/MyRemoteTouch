use image::GrayImage;
use tracing::{debug, info};
use crate::clients::WdaClient;
use crate::error::{AppError, AppResult};
use crate::smart_task::model::Region;
use crate::smart_task::snapshot;

/// 模板匹配结果
#[derive(Debug, Clone)]
pub struct MatchResult {
    /// 匹配位置（百分比坐标）
    pub x_pct: f64,
    pub y_pct: f64,
    /// 匹配区域尺寸（百分比）
    pub w_pct: f64,
    pub h_pct: f64,
    /// 匹配中心 PT 坐标
    pub center_x: f64,
    pub center_y: f64,
    /// 相似度 (0.0 ~ 1.0)
    pub similarity: f64,
}

/// 在当前屏幕中搜索模板图标
///
/// 使用灰度 NCC (Normalized Cross-Correlation) 滑动窗口匹配。
/// 粗搜 + 精搜两阶段提速。
pub async fn find_template(
    wda: &WdaClient,
    template_path: &str,
    search_region: Option<&Region>,
    threshold: f64,
    device_w: f64,
    device_h: f64,
) -> AppResult<Option<MatchResult>> {
    let template = image::open(template_path)
        .map_err(|e| AppError::Wda(format!("加载模板图片失败 '{}': {}", template_path, e)))?;

    let frame = snapshot::capture_frame(wda).await?;

    let search_img = match search_region {
        Some(r) => snapshot::crop_region(&frame, r)?,
        None => frame.clone(),
    };

    let haystack = search_img.to_luma8();
    let needle = template.to_luma8();

    let (nw, nh) = (needle.width(), needle.height());
    let (hw, hh) = (haystack.width(), haystack.height());

    if nw > hw || nh > hh {
        debug!("[Template] 模板 ({}x{}) 大于搜索区域 ({}x{})，跳过", nw, nh, hw, hh);
        return Ok(None);
    }

    // 粗搜
    let step: u32 = if hw > 400 || hh > 400 { 2 } else { 1 };
    let mut best_score: f64 = 0.0;
    let mut best_pos: (u32, u32) = (0, 0);

    for sy in (0..=(hh - nh)).step_by(step as usize) {
        for sx in (0..=(hw - nw)).step_by(step as usize) {
            let score = compute_ncc(&haystack, &needle, sx, sy);
            if score > best_score {
                best_score = score;
                best_pos = (sx, sy);
            }
        }
    }

    // 精搜
    if step > 1 {
        let min_x = best_pos.0.saturating_sub(step);
        let max_x = (best_pos.0 + step).min(hw - nw);
        let min_y = best_pos.1.saturating_sub(step);
        let max_y = (best_pos.1 + step).min(hh - nh);

        for sy in min_y..=max_y {
            for sx in min_x..=max_x {
                let score = compute_ncc(&haystack, &needle, sx, sy);
                if score > best_score {
                    best_score = score;
                    best_pos = (sx, sy);
                }
            }
        }
    }

    info!(
        "[Template] 最佳匹配: pos=({}, {}), similarity={:.3}, threshold={:.3}",
        best_pos.0, best_pos.1, best_score, threshold
    );

    if best_score >= threshold {
        let (fw, fh) = (frame.width() as f64, frame.height() as f64);
        let region_offset_x = search_region.map(|r| r.x_pct * fw).unwrap_or(0.0);
        let region_offset_y = search_region.map(|r| r.y_pct * fh).unwrap_or(0.0);

        let abs_x = region_offset_x + best_pos.0 as f64;
        let abs_y = region_offset_y + best_pos.1 as f64;

        Ok(Some(MatchResult {
            x_pct: abs_x / fw,
            y_pct: abs_y / fh,
            w_pct: nw as f64 / fw,
            h_pct: nh as f64 / fh,
            center_x: (abs_x + nw as f64 / 2.0) / fw * device_w,
            center_y: (abs_y + nh as f64 / 2.0) / fh * device_h,
            similarity: best_score,
        }))
    } else {
        Ok(None)
    }
}

/// 归一化互相关 (NCC)
fn compute_ncc(
    haystack: &GrayImage,
    needle: &GrayImage,
    offset_x: u32,
    offset_y: u32,
) -> f64 {
    let (nw, nh) = (needle.width(), needle.height());
    let count = (nw * nh) as f64;

    let mut mean_h: f64 = 0.0;
    let mut mean_n: f64 = 0.0;

    for ny in 0..nh {
        for nx in 0..nw {
            mean_h += haystack.get_pixel(offset_x + nx, offset_y + ny)[0] as f64;
            mean_n += needle.get_pixel(nx, ny)[0] as f64;
        }
    }
    mean_h /= count;
    mean_n /= count;

    let mut sum_hn: f64 = 0.0;
    let mut sum_hh: f64 = 0.0;
    let mut sum_nn: f64 = 0.0;

    for ny in 0..nh {
        for nx in 0..nw {
            let hv = haystack.get_pixel(offset_x + nx, offset_y + ny)[0] as f64 - mean_h;
            let nv = needle.get_pixel(nx, ny)[0] as f64 - mean_n;
            sum_hn += hv * nv;
            sum_hh += hv * hv;
            sum_nn += nv * nv;
        }
    }

    let denom = (sum_hh * sum_nn).sqrt();
    if denom < 1e-6 { 0.0 } else { (sum_hn / denom).max(0.0) }
}
