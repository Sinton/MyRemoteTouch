use idevice::usbmuxd::{UsbmuxdConnection, UsbmuxdListenEvent, Connection};
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::io;
use futures_util::StreamExt;
use std::pin::Pin;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_util::sync::CancellationToken;
use std::sync::Arc;
use tracing::{info, warn, error};
use crate::services::device::{DeviceManager, Device};

/// 将 idevice 的 ReadWrite socket 包装为 tokio 兼容的 AsyncRead + AsyncWrite
struct DeviceStream {
    inner: Box<dyn idevice::ReadWrite>,
}

impl AsyncRead for DeviceStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut io::ReadBuf<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        Pin::new(&mut *self.inner).poll_read(cx, buf)
    }
}

impl AsyncWrite for DeviceStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<Result<usize, std::io::Error>> {
        Pin::new(&mut *self.inner).poll_write(cx, buf)
    }

    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), std::io::Error>> {
        Pin::new(&mut *self.inner).poll_flush(cx)
    }

    fn poll_shutdown(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), std::io::Error>> {
        Pin::new(&mut *self.inner).poll_shutdown(cx)
    }
}

/// 通过 idevice 库的官方 API 连接设备端口，返回可直接桥接的异步流
async fn connect_device_port(device_id: u32, port: u16) -> Result<DeviceStream, Box<dyn std::error::Error + Send + Sync>> {
    let mux = UsbmuxdConnection::default().await?;
    let idev = mux.connect_to_device(device_id, port, "iproxy-rust").await?;
    let socket = idev.get_socket().ok_or("无法获取设备 socket")?;
    Ok(DeviceStream { inner: socket })
}

pub struct ProxyManager {
    cancel_token: CancellationToken,
    port_mappings: Vec<(u16, u16)>,
    device_manager: Arc<DeviceManager>,
}

impl ProxyManager {
    pub fn new(cancel_token: CancellationToken, port_mappings: Vec<(u16, u16)>, device_manager: Arc<DeviceManager>) -> Self {
        Self { 
            cancel_token,
            port_mappings,
            device_manager,
        }
    }

    /// 启动本地 TCP 监听器，并将所有传入连接桥接到 iOS 设备端口
    async fn start_proxy(local_port: u16, device_port: u16, token: CancellationToken, device_manager: Arc<DeviceManager>) {
        let addr = format!("127.0.0.1:{}", local_port);
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => l,
            Err(e) => {
                error!("端口 {} 绑定失败: {}", local_port, e);
                return;
            }
        };

        info!("本地监听器就绪: {} -> iOS:{}", addr, device_port);

        loop {
            tokio::select! {
                _ = token.cancelled() => {
                    info!("端口 {} 代理正在关闭", local_port);
                    break;
                }
                accept_result = listener.accept() => {
                    if let Ok((mut client_stream, peer_addr)) = accept_result {
                        let conn_token = token.clone();
                        let conn_device_manager = Arc::clone(&device_manager);
                        tokio::spawn(async move {
                            info!("收到来自 {} 的连接请求 (目标端口: {})", peer_addr, device_port);
                            
                            // 检查设备管理器中的设备
                            let device_count = conn_device_manager.device_count().await;
                            info!("当前 DeviceManager 中有 {} 个设备", device_count);
                            
                            let device = match conn_device_manager.get_first_device().await {
                                Some(d) => {
                                    info!("找到设备: DeviceID={}, UDID={}, 类型={}", 
                                        d.device_id, d.udid, d.connection_type.as_str());
                                    d
                                }
                                None => {
                                    warn!("未发现在线设备，拒绝来自 {} 的连接", peer_addr);
                                    warn!("提示: 请确保设备已连接并信任此电脑");
                                    return;
                                }
                            };

                            info!("正在连接设备端口 {}...", device_port);
                            match connect_device_port(device.device_id, device_port).await {
                                Ok(mut device_stream) => {
                                    info!("设备端口 {} 连接成功，开始数据转发", device_port);
                                    tokio::select! {
                                        _ = conn_token.cancelled() => {
                                            info!("连接被取消: {}", peer_addr);
                                        }
                                        result = io::copy_bidirectional(&mut client_stream, &mut device_stream) => {
                                            match result {
                                                Ok((to_device, to_client)) => {
                                                    info!("连接关闭: {} (发送: {} 字节, 接收: {} 字节)", 
                                                        peer_addr, to_device, to_client);
                                                }
                                                Err(e) => {
                                                    error!("数据传输错误: {}", e);
                                                }
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("连接设备端口 {} 失败: {}", device_port, e);
                                }
                            }
                        });
                    }
                }
            }
        }
    }

    /// 启动设备监听器
    async fn start_device_listener(app_handle: AppHandle, token: CancellationToken, device_manager: Arc<DeviceManager>) {
        info!("启动设备监听器...");
        let local = tokio::task::LocalSet::new();
        local.run_until(async move {
            loop {
                tokio::select! {
                    _ = token.cancelled() => {
                        info!("设备监听器正在关闭");
                        break;
                    }
                    _ = async {
                        info!("尝试连接 usbmuxd...");
                        if let Ok(mut mux) = UsbmuxdConnection::default().await {
                            info!("usbmuxd 连接成功");
                            // 首次启动时获取已有设备
                            match mux.get_devices().await {
                                Ok(devices) => {
                                    info!("发现 {} 个设备", devices.len());
                                    for d in &devices {
                                        let device = Device::from_usbmuxd_device(d);
                                        info!("发现设备: DeviceID={}, UDID={}, 连接={}", 
                                            device.device_id, device.udid, device.connection_type.as_str());
                                        device_manager.add_device(device.clone()).await;
                                        
                                        // 只对 USB 设备发出事件
                                        if matches!(d.connection_type, Connection::Usb) {
                                            let _ = app_handle.emit("device-connected", d.udid.clone());
                                        }
                                    }
                                    
                                    // 打印当前设备管理器中的设备数量
                                    let count = device_manager.device_count().await;
                                    info!("DeviceManager 中现有 {} 个设备", count);

                                    // 触发就绪信号，通知健康检查等服务可以开始了
                                    device_manager.signal_ready();
                                    info!("已发送设备就绪信号");
                                }
                                Err(e) => {
                                    error!("获取设备列表失败: {:?}", e);
                                    // 即使失败也尝试发送信号，避免下游服务无限期等待
                                    device_manager.signal_ready();
                                }
                            }

                            // 持续监听设备变化
                            info!("开始监听设备变化...");
                            if let Ok(mut stream) = mux.listen().await {
                                while let Some(event) = stream.next().await {
                                    tokio::select! {
                                        _ = token.cancelled() => break,
                                        _ = async {} => {
                                            match event {
                                                Ok(UsbmuxdListenEvent::Connected(dev)) => {
                                                    let device = Device::from_usbmuxd_device(&dev);
                                                    info!("设备连接: DeviceID={}, UDID={}", device.device_id, device.udid);
                                                    device_manager.add_device(device.clone()).await;
                                                    
                                                    if matches!(dev.connection_type, Connection::Usb) {
                                                        let _ = app_handle.emit("device-connected", dev.udid);
                                                    }
                                                }
                                                Ok(UsbmuxdListenEvent::Disconnected(id)) => {
                                                    info!("设备断开: DeviceID={}", id);
                                                    device_manager.remove_device(id).await;
                                                    let _ = app_handle.emit("device-disconnected", id);
                                                }
                                                Err(e) => {
                                                    error!("监听事件错误: {:?}", e);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                error!("无法启动设备监听流");
                            }
                        } else {
                            error!("无法连接到 usbmuxd");
                        }
                        info!("3秒后重试连接 usbmuxd...");
                        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                    } => {}
                }
            }
        }).await;
    }

    /// 初始化所有代理服务
    pub fn init_proxies(self: Arc<Self>, app_handle: AppHandle) {
        let token = self.cancel_token.clone();
        let port_mappings = self.port_mappings.clone();
        let device_manager = Arc::clone(&self.device_manager);
        
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async move {
                // 启动所有配置的 TCP 代理
                for (local_port, device_port) in port_mappings {
                    let proxy_token = token.clone();
                    let proxy_device_manager = Arc::clone(&device_manager);
                    tokio::spawn(async move {
                        Self::start_proxy(local_port, device_port, proxy_token, proxy_device_manager).await;
                    });
                }

                // 启动设备监听器
                Self::start_device_listener(app_handle, token, device_manager).await;
            });
        });
    }

    /// 优雅关闭所有代理
    #[allow(dead_code)]
    pub fn shutdown(&self) {
        info!("正在关闭所有代理服务...");
        self.cancel_token.cancel();
    }
}
