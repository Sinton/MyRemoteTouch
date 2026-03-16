use tokio::sync::RwLock;
use idevice::usbmuxd::{UsbmuxdConnection, UsbmuxdDevice, Connection};
use crate::error::{AppResult, AppError};
use tracing::info;

/// 设备连接类型
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionType {
    Usb,
    Network(String),
    Unknown(String),
}

impl From<&Connection> for ConnectionType {
    fn from(conn: &Connection) -> Self {
        match conn {
            Connection::Usb => ConnectionType::Usb,
            Connection::Network(addr) => ConnectionType::Network(addr.to_string()),
            Connection::Unknown(s) => ConnectionType::Unknown(s.clone()),
        }
    }
}

impl ConnectionType {
    pub fn as_str(&self) -> &str {
        match self {
            ConnectionType::Usb => "USB",
            ConnectionType::Network(_) => "WiFi",
            ConnectionType::Unknown(s) => s.as_str(),
        }
    }
}

/// 设备信息
#[derive(Debug, Clone)]
pub struct Device {
    pub device_id: u32,
    pub udid: String,
    pub connection_type: ConnectionType,
}

impl Device {
    pub fn from_usbmuxd_device(device: &UsbmuxdDevice) -> Self {
        Self {
            device_id: device.device_id,
            udid: device.udid.clone(),
            connection_type: ConnectionType::from(&device.connection_type),
        }
    }
}

/// 设备管理器
pub struct DeviceManager {
    devices: RwLock<Vec<Device>>,
    ready_signal: tokio::sync::Notify,
}

#[allow(dead_code)]
impl DeviceManager {
    pub fn new() -> Self {
        Self {
            devices: RwLock::new(Vec::new()),
            ready_signal: tokio::sync::Notify::new(),
        }
    }

    /// 等待第一轮设备扫描完成
    pub async fn wait_for_ready(&self) {
        self.ready_signal.notified().await;
    }

    /// 发送扫描完成信号
    pub fn signal_ready(&self) {
        self.ready_signal.notify_waiters();
    }

    /// 添加设备
    pub async fn add_device(&self, device: Device) {
        let mut devices = self.devices.write().await;
        if !devices.iter().any(|d| d.device_id == device.device_id) {
            info!("添加设备: ID={}, UDID={}, 类型={}", 
                device.device_id, device.udid, device.connection_type.as_str());
            devices.push(device);
        }
    }

    /// 移除设备
    pub async fn remove_device(&self, device_id: u32) {
        let mut devices = self.devices.write().await;
        if let Some(pos) = devices.iter().position(|d| d.device_id == device_id) {
            let device = devices.remove(pos);
            info!("移除设备: ID={}, UDID={}", device.device_id, device.udid);
        }
    }

    /// 获取所有设备
    pub async fn get_devices(&self) -> Vec<Device> {
        self.devices.read().await.clone()
    }

    /// 获取第一个 USB 设备
    pub async fn get_first_usb_device(&self) -> Option<Device> {
        self.devices.read().await
            .iter()
            .find(|d| d.connection_type == ConnectionType::Usb)
            .cloned()
    }

    /// 获取第一个设备（优先 USB）
    pub async fn get_first_device(&self) -> Option<Device> {
        let devices = self.devices.read().await;
        devices.iter()
            .find(|d| d.connection_type == ConnectionType::Usb)
            .or_else(|| devices.first())
            .cloned()
    }

    /// 根据 ID 获取设备
    pub async fn get_device_by_id(&self, device_id: u32) -> Option<Device> {
        self.devices.read().await
            .iter()
            .find(|d| d.device_id == device_id)
            .cloned()
    }

    /// 扫描当前连接的设备
    pub async fn scan_devices(&self) -> AppResult<Vec<Device>> {
        let mut mux = UsbmuxdConnection::default().await
            .map_err(|_| AppError::DeviceNotFound)?;
        
        let usbmuxd_devices = mux.get_devices().await
            .map_err(|_| AppError::DeviceNotFound)?;
        
        let devices: Vec<Device> = usbmuxd_devices.iter()
            .map(Device::from_usbmuxd_device)
            .collect();
        
        Ok(devices)
    }

    /// 同步设备列表
    pub async fn sync_devices(&self) -> AppResult<()> {
        let scanned = self.scan_devices().await?;
        let mut devices = self.devices.write().await;
        
        // 移除已断开的设备
        devices.retain(|d| scanned.iter().any(|s| s.device_id == d.device_id));
        
        // 添加新设备
        for device in scanned {
            if !devices.iter().any(|d| d.device_id == device.device_id) {
                info!("发现新设备: ID={}, UDID={}, 类型={}", 
                    device.device_id, device.udid, device.connection_type.as_str());
                devices.push(device);
            }
        }
        
        Ok(())
    }

    /// 获取设备数量
    pub async fn device_count(&self) -> usize {
        self.devices.read().await.len()
    }

    /// 清空设备列表
    pub async fn clear(&self) {
        self.devices.write().await.clear();
    }
}
