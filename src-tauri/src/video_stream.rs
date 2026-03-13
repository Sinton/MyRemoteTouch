use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use futures_util::{StreamExt, SinkExt};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::broadcast;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

pub async fn start_video_server(ws_port: u16, device_port: u16, token: CancellationToken) {
    let (tx, _rx) = broadcast::channel::<Arc<Vec<u8>>>(10);
    let tx = Arc::new(tx);

    let tx_clone = Arc::clone(&tx);
    let worker_token = token.clone();
    
    // Video Worker Task
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = worker_token.cancelled() => break,
                _ = async {
                    if let Ok(mut device_stream) = TcpStream::connect(format!("127.0.0.1:{}", device_port)).await {
                        let request = "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n";
                        if device_stream.write_all(request.as_bytes()).await.is_err() {
                            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                            return;
                        }

                        let mut buffer = vec![0u8; 65536];
                        let mut data_acc = Vec::with_capacity(256 * 1024);
                        loop {
                            match device_stream.read(&mut buffer).await {
                                Ok(0) => break,
                                Ok(n) => {
                                    data_acc.extend_from_slice(&buffer[..n]);
                                    while let Some(start_pos) = find_subsequence(&data_acc, &[0xFF, 0xD8]) {
                                        if let Some(end_pos) = find_subsequence(&data_acc[start_pos..], &[0xFF, 0xD9]) {
                                            let frame_end = start_pos + end_pos + 2;
                                            let frame = data_acc[start_pos..frame_end].to_vec();
                                            let _ = tx_clone.send(Arc::new(frame));
                                            data_acc.drain(..frame_end);
                                        } else { break; }
                                    }
                                    if data_acc.len() > 1024 * 1024 { data_acc.clear(); }
                                }
                                Err(_) => break,
                            }
                        }
                    } else {
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    }
                } => {}
            }
        }
    });

    // WebSocket Listener Server
    let addr = format!("127.0.0.1:{}", ws_port);
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind WS video port");
    
    loop {
        tokio::select! {
            _ = token.cancelled() => break,
            accept_res = listener.accept() => {
                if let Ok((stream, _)) = accept_res {
                    let tx_sub = Arc::clone(&tx);
                    let client_token = token.clone();
                    tokio::spawn(async move {
                        if let Ok(ws_stream) = accept_async(stream).await {
                            let (mut ws_write, _) = ws_stream.split();
                            let mut rx = tx_sub.subscribe();
                            loop {
                                tokio::select! {
                                    _ = client_token.cancelled() => break,
                                    recv_res = rx.recv() => {
                                        match recv_res {
                                            Ok(frame) => {
                                                if ws_write.send(Message::Binary(frame.to_vec().into())).await.is_err() { break; }
                                            }
                                            Err(broadcast::error::RecvError::Lagged(_)) => continue,
                                            Err(_) => break,
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
    }
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}
