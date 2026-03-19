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
    /// v2.1: 多候选选择器 — 按优先级依次尝试多个选择器，首个命中即采用
    MultiMatch {
        candidates: Vec<SelectorCandidate>,
    },
}

/// MultiMatch 内的候选项（避免递归嵌套 Selector 导致 serde tag 冲突）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SelectorCandidate {
    WdaLabel { value: String },
    WdaPredicate { value: String },
    OcrText { value: String, region: Option<Region> },
    TemplateIcon { icon_id: String, region: Option<Region> },
}

impl SelectorCandidate {
    /// 将候选项提升为完整的 Selector（供 hybrid_selector::resolve 调用）
    pub fn to_selector(&self) -> Selector {
        match self {
            SelectorCandidate::WdaLabel { value } => Selector::WdaLabel { value: value.clone() },
            SelectorCandidate::WdaPredicate { value } => Selector::WdaPredicate { value: value.clone() },
            SelectorCandidate::OcrText { value, region } => Selector::OcrText {
                value: value.clone(),
                region: region.clone(),
            },
            SelectorCandidate::TemplateIcon { icon_id, region } => Selector::TemplateIcon {
                icon_id: icon_id.clone(),
                region: region.clone(),
            },
        }
    }
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
        /// v2.1: 提前唤醒秒数，实际休眠 = max(0, extracted - early_wake_secs)
        #[serde(default)]
        early_wake_secs: Option<u64>,
    },
    /// 退出任务（成功结束）
    Finish,
}

/// v2.1: 步骤成功后的跳转策略
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SuccessRoute {
    /// 固定跳转到指定步骤（兼容 v2.0 的 on_success: Option<String>）
    Next {
        step_id: String,
    },
    /// 条件路由分叉 — 根据匹配到的文本内容选择跳转目标
    ConditionalRoute {
        routes: Vec<ConditionalBranch>,
        /// 兜底跳转：所有条件都不满足时走这里
        default: String,
    },
    /// 任务结束（无后续步骤）
    Finish,
}

/// 条件分叉的单条路由规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionalBranch {
    /// 匹配条件：matched_text CONTAINS 此字符串时走该分支
    pub text_contains: String,
    /// 跳转目标步骤 ID
    pub goto_step: String,
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
    /// v2.1: 识别成功时的跳转策略（替代原来的 Option<String>）
    pub on_success: SuccessRoute,
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
    /// v2.1: 最大循环次数（防止死循环），0 表示不限制
    #[serde(default)]
    pub max_loop_count: u32,
    /// 步骤列表
    pub steps: Vec<Step>,
    /// 入口步骤 ID
    pub entry: String,
}
