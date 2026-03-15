use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc;
use crate::video::h264::H264Packet;
use idevice::usbmuxd::{UsbmuxdConnection, UsbmuxdDevice};
use idevice::lockdown::LockdownClient;
use plist::Value;
use byteorder::LittleEndian;
use std::io::Cursor;

pub struct H264DvtProvider {
    udid: String,
    sender: mpsc::Sender<H264Packet>,
}

#[derive(Debug, Clone)]
struct DtxFragmentHeader {
    magic: u32,
    header_size: u32,
    index: u16,
    count: u16,
    data_size: u32,
    identifier: u32,
    conversation_index: u32,
    channel_code: i32,
    flags: u32,
}

impl DtxFragmentHeader {
    fn encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(32);
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, self.magic).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, self.header_size).unwrap();
        byteorder::WriteBytesExt::write_u16::<LittleEndian>(&mut buf, self.index).unwrap();
        byteorder::WriteBytesExt::write_u16::<LittleEndian>(&mut buf, self.count).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, self.data_size).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, self.identifier).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, self.conversation_index).unwrap();
        byteorder::WriteBytesExt::write_i32::<LittleEndian>(&mut buf, self.channel_code).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, self.flags).unwrap();
        buf
    }

    fn decode(buf: &[u8]) -> Self {
        let mut rdr = Cursor::new(buf);
        Self {
            magic: byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr).unwrap(),
            header_size: byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr).unwrap(),
            index: byteorder::ReadBytesExt::read_u16::<LittleEndian>(&mut rdr).unwrap(),
            count: byteorder::ReadBytesExt::read_u16::<LittleEndian>(&mut rdr).unwrap(),
            data_size: byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr).unwrap(),
            identifier: byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr).unwrap(),
            conversation_index: byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr).unwrap(),
            channel_code: byteorder::ReadBytesExt::read_i32::<LittleEndian>(&mut rdr).unwrap(),
            flags: byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr).unwrap(),
        }
    }
}

enum DtxArg {
    Int32(i32),
    String(String),
}

fn encode_aux(selector: &str, args: Vec<DtxArg>) -> Vec<u8> {
    let mut aux_body = Vec::new();
    
    // Argument 0: Selector
    byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut aux_body, 10).unwrap(); // Key PNULL
    byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut aux_body, 1).unwrap();  // Value PStr
    let sel_b = selector.as_bytes();
    byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut aux_body, sel_b.len() as u32).unwrap();
    aux_body.extend_from_slice(sel_b);
    
    // Arguments 1..N
    for arg in args {
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut aux_body, 10).unwrap(); // Key PNULL
        match arg {
            DtxArg::Int32(v) => {
                byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut aux_body, 3).unwrap();
                byteorder::WriteBytesExt::write_i32::<LittleEndian>(&mut aux_body, v).unwrap();
            }
            DtxArg::String(s) => {
                byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut aux_body, 1).unwrap();
                let b = s.as_bytes();
                byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut aux_body, b.len() as u32).unwrap();
                aux_body.extend_from_slice(b);
            }
        }
    }

    let mut buf = Vec::new();
    byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, 0x1F0).unwrap(); // Magic + Tag 0xF0
    byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut buf, 0).unwrap();
    byteorder::WriteBytesExt::write_u64::<LittleEndian>(&mut buf, aux_body.len() as u64).unwrap();
    buf.extend_from_slice(&aux_body);
    buf
}

impl H264DvtProvider {
    pub fn new(udid: String, sender: mpsc::Sender<H264Packet>) -> Self {
        Self { udid, sender }
    }

    pub async fn run(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        println!(">>> [H264-DVT] 初始化 Scheme D (DVT协议)...");

        let mut mux = UsbmuxdConnection::default().await?;
        let devices: Vec<UsbmuxdDevice> = mux.get_devices().await?;
        let device_info = devices.iter().find(|d| d.udid == self.udid)
            .ok_or_else(|| format!("未找到设备: {}", self.udid))?;
        
        // 获取配对记录，SSL 会话启动必不可少
        let pairing_record = mux.get_pair_record(&self.udid).await
            .map_err(|_| "无法获取配对记录，请确保手机已信任电脑")?;

        // 1. 通过 mux 连接到 Lockdown 端口 (62078)
        let device_id = device_info.device_id;
        let lockdown_stream = mux.connect_to_device(device_id, 62078, "h264-lockdown").await?;
        let lockdown_socket = lockdown_stream.get_socket().ok_or("无法获取 lockdown socket")?;
        
        // 2. 初始化 LockdownClient 并启动 SSL 会话
        let idev = idevice::Idevice::new(lockdown_socket, self.udid.clone());
        let mut lockdown = LockdownClient::new(idev);
        lockdown.start_session(&pairing_record).await?;
        
        println!(">>> [H264-DVT] 启动 DVT 代理服务...");
        let service_name = "com.apple.instruments.remoteserver.DVTSecureSocketProxy";
        let service_res = lockdown.start_service(service_name).await?;
        let port = service_res.0;
        
        // 3. 连接到 DVT 代理服务
        let mux_dvt = UsbmuxdConnection::default().await?;
        let stream = mux_dvt.connect_to_device(device_id, port, "h264-dvt").await?;
        let socket = stream.get_socket().ok_or("无法获取 socket")?;
        let (mut reader, mut writer) = tokio::io::split(socket);

        // 4. 握手
        println!(">>> [H264-DVT] 发送握手信号...");
        let mut caps_m = plist::dictionary::Dictionary::new();
        caps_m.insert("com.apple.private.DTXBlockCompression".to_string(), Value::Integer(0.into()));
        caps_m.insert("com.apple.private.DTXConnection".to_string(), Value::Integer(1.into()));
        let mut caps_p = Vec::new();
        Value::Dictionary(caps_m).to_writer_binary(&mut caps_p)?;
        
        self.send_msg(&mut writer, 0, 0, 0, 2, "_notifyOfPublishedCapabilities:", vec![], Some(&caps_p)).await?;

        // 5. 激活 Display 频道
        let display_channel = 1;
        println!(">>> [H264-DVT] 请求 Display 频道...");
        self.send_msg(&mut writer, 1, 0, 0, 2, "_requestChannelWithCode:identifier:", 
            vec![DtxArg::Int32(display_channel), DtxArg::String("com.apple.instruments.server.services.display".to_string())], 
            None).await?;

        // 6. 开启屏幕捕获
        println!(">>> [H264-DVT] 激活 H.264 镜像流...");
        let mut config_m = plist::dictionary::Dictionary::new();
        let mut attrs_m = plist::dictionary::Dictionary::new();
        attrs_m.insert("kDTDisplayCaptureConfig_DisplayID".to_string(), Value::Integer(0.into()));
        attrs_m.insert("kDTDisplayCaptureConfig_FPS".to_string(), Value::Integer(30.into()));
        attrs_m.insert("kDTDisplayCaptureConfig_RecordVideo".to_string(), Value::Boolean(true));
        attrs_m.insert("kDTDisplayCaptureConfig_VideoFormat".to_string(), Value::String("h264".to_string()));
        config_m.insert("attributes".to_string(), Value::Dictionary(attrs_m));
        
        let mut config_p = Vec::new();
        Value::Dictionary(config_m).to_writer_binary(&mut config_p)?;
        
        self.send_msg(&mut writer, 2, 0, display_channel, 2, "startCapturingDisplayWithConfig:", vec![], Some(&config_p)).await?;

        // 7. 接收循环
        println!(">>> [H264-DVT] 进入数据接收循环...");
        let mut buf32 = [0u8; 32];
        loop {
            reader.read_exact(&mut buf32).await?;
            let header = DtxFragmentHeader::decode(&buf32);
            
            let mut body = vec![0u8; header.data_size as usize];
            reader.read_exact(&mut body).await?;
            
            if header.channel_code == display_channel {
                if body.len() >= 16 {
                    let mut rdr = Cursor::new(&body);
                    let _msg_type = byteorder::ReadBytesExt::read_u8(&mut rdr)?;
                    let _ = byteorder::ReadBytesExt::read_u8(&mut rdr)?;
                    let _ = byteorder::ReadBytesExt::read_u8(&mut rdr)?;
                    let _ = byteorder::ReadBytesExt::read_u8(&mut rdr)?;
                    let aux_size = byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr)?;
                    let _total_size = byteorder::ReadBytesExt::read_u32::<LittleEndian>(&mut rdr)?;
                    
                    let h264_data = &body[16 + aux_size as usize ..];
                    if !h264_data.is_empty() {
                        let _ = self.sender.send(H264Packet::Data(h264_data.to_vec())).await;
                    }
                }
            }
        }
    }

    async fn send_msg<W: AsyncWriteExt + Unpin>(
        &self,
        writer: &mut W,
        identifier: u32,
        conv_idx: u32,
        channel: i32,
        msg_type: u8,
        selector: &str,
        args: Vec<DtxArg>,
        payload: Option<&[u8]>
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let aux = encode_aux(selector, args);
        let payload_data = payload.unwrap_or(&[]);
        
        let mut body = Vec::new();
        byteorder::WriteBytesExt::write_u8(&mut body, msg_type).unwrap();
        byteorder::WriteBytesExt::write_u8(&mut body, 0).unwrap(); 
        byteorder::WriteBytesExt::write_u8(&mut body, 0).unwrap(); 
        byteorder::WriteBytesExt::write_u8(&mut body, 0).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut body, aux.len() as u32).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut body, (aux.len() + payload_data.len()) as u32).unwrap();
        byteorder::WriteBytesExt::write_u32::<LittleEndian>(&mut body, 0).unwrap();
        
        body.extend_from_slice(&aux);
        body.extend_from_slice(payload_data);

        let f_header = DtxFragmentHeader {
            magic: 0x1F3D5B79,
            header_size: 32,
            index: 0,
            count: 1,
            data_size: body.len() as u32,
            identifier,
            conversation_index: conv_idx,
            channel_code: channel,
            flags: 1,
        };

        writer.write_all(&f_header.encode()).await?;
        writer.write_all(&body).await?;
        writer.flush().await?;
        Ok(())
    }
}
