use serde::{Deserialize, Serialize};
use tracing::debug;
use crate::clients::WdaClient;
use crate::error::AppResult;

/// 元素检查结果（百分比坐标，跨设备兼容）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectResult {
    /// 元素的可见标签文本
    pub label: String,
    /// WDA 元素类型（如 XCUIElementTypeButton）
    pub element_type: String,
    /// 元素矩形 —— 全部使用百分比坐标
    pub x_pct: f64,
    pub y_pct: f64,
    pub w_pct: f64,
    pub h_pct: f64,
    /// 原始的 WDA PT 坐标（px）
    pub raw_x: f64,
    pub raw_y: f64,
    pub raw_width: f64,
    pub raw_height: f64,
}

/// 通过前端传入的百分比坐标，在 WDA UI 树中找到命中元素
///
/// # 参数
/// - `x_pct` / `y_pct`: 前端 Canvas 上的百分比坐标（0.0 ~ 1.0）
/// - `device_w` / `device_h`: 设备物理尺寸（PT，来自 WDA window/size）
///
/// # 实现策略
/// 一次性拉取 `get_source` JSON 树，遍历查找坐标命中的叶子节点（depth-first），
/// 取最深层命中者（最精确的子元素），避免频繁 HTTP 请求。
pub async fn inspect_at(
    wda: &WdaClient,
    x_pct: f64,
    y_pct: f64,
    device_w: f64,
    device_h: f64,
) -> AppResult<Option<InspectResult>> {
    // 还原为设备 PT 坐标
    let target_x = x_pct * device_w;
    let target_y = y_pct * device_h;

    debug!(
        "[Inspector] 查询坐标: ({:.1}, {:.1}) PT，百分比: ({:.3}, {:.3})",
        target_x, target_y, x_pct, y_pct
    );

    let source = wda.get_source().await?;

    // 从 UI 树中遍历查找命中元素
    let root = &source["value"];
    let result = find_deepest_hit(root, target_x, target_y, device_w, device_h);

    Ok(result)
}

/// 深度优先遍历 WDA UI 树，找到包含目标坐标的最深层子元素
fn find_deepest_hit(
    node: &serde_json::Value,
    tx: f64,
    ty: f64,
    device_w: f64,
    device_h: f64,
) -> Option<InspectResult> {
    // 先尝试从子节点中找更精确的命中 (倒序遍历，后加载的子节点通常在最上层)
    if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
        for child in children.iter().rev() {
            if let Some(result) = find_deepest_hit(child, tx, ty, device_w, device_h) {
                return Some(result);
            }
        }
    }

    // 子节点没有命中，尝试当前节点
    let frame = node.get("frame")?;
    let x = frame.get("x")?.as_f64()?;
    let y = frame.get("y")?.as_f64()?;
    let w = frame.get("width")?.as_f64()?;
    let h = frame.get("height")?.as_f64()?;

    // 判断目标坐标是否在此元素矩形内
    if tx >= x && tx <= x + w && ty >= y && ty <= y + h && w > 0.0 && h > 0.0 {
        let label = node
            .get("label")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let element_type = node
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        debug!(
            "[Inspector] 命中元素: type='{}', label='{}', frame=({:.0},{:.0},{:.0},{:.0})",
            element_type, label, x, y, w, h
        );

        Some(InspectResult {
            label,
            element_type,
            x_pct: x / device_w,
            y_pct: y / device_h,
            w_pct: w / device_w,
            h_pct: h / device_h,
            raw_x: x,
            raw_y: y,
            raw_width: w,
            raw_height: h,
        })
    } else {
        None
    }
}
