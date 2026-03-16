//! 客户端层
//! 
//! 包含所有外部服务的客户端实现，负责协议封装和网络通信。

pub mod wda;

// 重新导出常用类型
pub use wda::{WdaClient, WdaResponse, WdaStatus};
