//! 服务层
//! 
//! 包含所有后台服务的实现，负责业务逻辑处理和状态管理。

pub mod health;
pub mod video;
pub mod proxy;
pub mod device;

// 重新导出常用类型，简化外部导入
pub use health::HealthService;
pub use video::VideoService;
pub use proxy::ProxyManager;
pub use device::DeviceManager;
