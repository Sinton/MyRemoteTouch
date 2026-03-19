use serde::{Deserialize, Serialize};

/// 识别区域（百分比坐标，兼容不同设备分辨率）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Region {
    pub x_pct: f64,
    pub y_pct: f64,
    pub w_pct: f64,
    pub h_pct: f64,
}

/// 选择器类型（多模态混合识别，优先级：WDA Label > Predicate > OCR）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Selector {
    /// 精确匹配 WDA 元素的 label 属性
    WdaLabel {
        value: String,
    },
    /// WDA Predicate String，支持 CONTAINS / MATCHES 等表达式
    WdaPredicate {
        value: String,
    },
    /// 指定区域内的 OCR 文本匹配（支持正则）
    OcrText {
        value: String,
        region: Option<Region>,
    },
    /// 图标特征模板匹配（Phase 4 实现）
    TemplateIcon {
        icon_id: String,
        region: Option<Region>,
    },
}

/// 动作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    /// 点击元素中心（支持 offset 微调）
    Tap {
        offset_x: f64,
        offset_y: f64,
    },
    /// 智能等待：从识别结果提取数字变量作为休眠时长（单位：秒）
    SmartSleep {
        variable: String,
        fallback_secs: u64,
    },
    /// 退出任务（成功结束）
    Finish,
}

/// 步骤失败时的处理策略
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailurePolicy {
    /// 重试当前步骤（最多 retry_limit 次）
    Retry,
    /// 跳转到指定步骤
    GotoStep(String),
    /// 中止整个任务
    Abort,
}

/// 单个自动化步骤
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    /// 步骤全局唯一 ID（用于 on_success / on_failure 跳转）
    pub id: String,
    /// 步骤名称（用于 UI 显示）
    pub name: String,
    /// 元素识别器
    pub selector: Selector,
    /// 识别成功后执行的动作
    pub action: Action,
    /// 执行动作前的等待时间（ms）
    pub pre_delay_ms: u64,
    /// 执行动作后的等待时间（ms）
    pub post_delay_ms: u64,
    /// 超时阈值（ms），识别器超时后触发 failure_policy
    pub timeout_ms: u64,
    /// 识别成功时跳转的下一个步骤 ID（None 表示结束）
    pub on_success: Option<String>,
    /// 识别失败时的处理策略
    pub on_failure: FailurePolicy,
}

/// 完整任务定义（DSL 根节点）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    /// 全局唯一任务 ID（UUID）
    pub task_id: String,
    /// 任务名称
    pub name: String,
    /// 全局最大重试次数
    pub retry_limit: u32,
    /// 任务全局超时（秒）
    pub global_timeout_secs: u64,
    /// 模拟人工延迟范围 (最小ms, 最大ms)
    pub human_delay_range: (u64, u64),
    /// 步骤列表
    pub steps: Vec<Step>,
    /// 入口步骤 ID
    pub entry: String,
}
