//! SmartTask 智能自动化引擎
//!
//! 提供基于 DSL 的任务录制、存储与异步执行能力。
//! 架构：前端可视化录制 → JSON DSL → Rust 状态机执行

pub mod hybrid_selector;
pub mod inspector;
pub mod model;
pub mod ocr;
pub mod persistence;
pub mod runner;
pub mod snapshot;
pub mod template_matcher;

pub use model::{Action, Selector, Step, Task};
