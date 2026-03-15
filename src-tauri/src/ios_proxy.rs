use idevice::usbmuxd::{UsbmuxdConnection, UsbmuxdDevice, UsbmuxdListenEvent, Connection};
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::io;
use futures_util::StreamExt;
use std::pin::Pin;
use tokio::io::{AsyncRead, AsyncWrite};

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

/// 从设备列表中找到第一个 USB 连接的设备
fn find_usb_device(devices: &[UsbmuxdDevice]) -> Option<&UsbmuxdDevice> {
    // 优先选择 USB 连接的设备
    devices.iter().find(|d| matches!(d.connection_type, Connection::Usb))
        .or_else(|| devices.first()) // 回退到第一个设备
}

/// 获取当前可用的 USB 设备 ID（每次实时扫描）
async fn get_device_id() -> Option<u32> {
    match UsbmuxdConnection::default().await {
        Ok(mut mux) => {
            if let Ok(devices) = mux.get_devices().await {
                return find_usb_device(&devices).map(|d| d.device_id);
            }
        }
        Err(_) => {}
    }
    None
}

/// 启动本地 TCP 监听器，并将所有传入连接桥接到 iOS 设备端口
pub async fn start_proxy(local_port: u16, device_port: u16) {
    let addr = format!("127.0.0.1:{}", local_port);
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            println!(">>> [iOS Proxy] 端口 {} 绑定失败: {}", local_port, e);
            return;
        }
    };

    println!(">>> [iOS Proxy] 本地监听器就绪: {} -> iOS:{}", addr, device_port);

    loop {
        if let Ok((mut client_stream, peer_addr)) = listener.accept().await {
            tokio::spawn(async move {
                let device_id = match get_device_id().await {
                    Some(id) => id,
                    None => {
                        println!(">>> [iOS Proxy] 未发现在线设备，拒绝来自 {} 的连接", peer_addr);
                        return;
                    }
                };

                match connect_device_port(device_id, device_port).await {
                    Ok(mut device_stream) => {
                        let _ = io::copy_bidirectional(&mut client_stream, &mut device_stream).await;
                    }
                    Err(e) => {
                        println!(">>> [iOS Proxy] 连接设备端口 {} 失败: {}", device_port, e);
                    }
                }
            });
        }
    }
}

pub fn init_proxies(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async move {
            // 1. 立即启动本地 TCP 监听器（不等待设备连接）
            tokio::spawn(async { start_proxy(8100, 8100).await; });
            tokio::spawn(async { start_proxy(9100, 9100).await; });

            // 2. 在 LocalSet 中监听设备拔插事件（idevice 的 stream 是 !Send）
            let local = tokio::task::LocalSet::new();
            local.run_until(async move {
                loop {
                    if let Ok(mut mux) = UsbmuxdConnection::default().await {
                        // 首次启动时获取已有设备
                        if let Ok(devices) = mux.get_devices().await {
                            for d in &devices {
                                let conn_type = match &d.connection_type {
                                    Connection::Usb => "USB",
                                    Connection::Network(_) => "WiFi",
                                    Connection::Unknown(s) => s.as_str(),
                                };
                                println!(">>> [iOS Proxy] 发现设备: UDID={}, DeviceID={}, 连接={}", d.udid, d.device_id, conn_type);
                            }
                            // 只对 USB 设备发出 connected 事件
                            if let Some(usb_dev) = find_usb_device(&devices) {
                                let _ = app_handle.emit("device-connected", usb_dev.udid.clone());
                            }
                        }

                        // 持续监听设备变化
                        if let Ok(mut stream) = mux.listen().await {
                            while let Some(event) = stream.next().await {
                                match event {
                                    Ok(UsbmuxdListenEvent::Connected(dev)) => {
                                        let conn_type = match &dev.connection_type {
                                            Connection::Usb => "USB",
                                            Connection::Network(_) => "WiFi",
                                            Connection::Unknown(s) => s.as_str(),
                                        };
                                        println!(">>> [iOS Proxy] 设备接入: UDID={}, DeviceID={}, 连接={}", dev.udid, dev.device_id, conn_type);
                                        if matches!(dev.connection_type, Connection::Usb) {
                                            let _ = app_handle.emit("device-connected", dev.udid);
                                        }
                                    }
                                    Ok(UsbmuxdListenEvent::Disconnected(id)) => {
                                        println!(">>> [iOS Proxy] 设备断开: DeviceID={}", id);
                                        let _ = app_handle.emit("device-disconnected", id);
                                    }
                                    Err(_) => break,
                                }
                            }
                        }
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                }
            }).await;
        });
    });
}
