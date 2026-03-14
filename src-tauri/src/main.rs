// Prevents additional console window on Windows in release, do not remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
mod ios_proxy;
mod wda_client;
mod video_stream;
pub mod error;
pub mod commands;

use crate::wda_client::WdaClient;
use tokio_util::sync::CancellationToken;

const WDA_URL: &str = "http://127.0.0.1:8100";

fn main() {
    let cancel_token = CancellationToken::new();
    let app_token = cancel_token.clone();

    tauri::Builder::default()
        .manage(WdaClient::new(WDA_URL))
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let handle = app.handle().clone();
            let token = app_token.clone();
            
            ios_proxy::init_proxies(handle.clone());
            
            let video_token = token.clone();
            tauri::async_runtime::spawn(async move {
                video_stream::start_video_server(9999, 9100, video_token).await;
            });

            let heartbeat_token = token.clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(20));
                loop {
                    tokio::select! {
                        _ = heartbeat_token.cancelled() => break,
                        _ = interval.tick() => {
                            let wda_state = handle.state::<WdaClient>();
                            // 如果健康检查失败，再给一次机会，防止是因为处理手势导致的瞬时阻塞
                            if !wda_state.check_health().await {
                                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                                if !wda_state.check_health().await {
                                    eprintln!(">>> [Heartbeat] WDA 连接异常 (确认确认失联)");
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(move |_, event| {
            if let tauri::WindowEvent::Destroyed = event {
                cancel_token.cancel();
                println!(">>> [Main] 正在停机并清理资源...");
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::device::get_window_size,
            commands::device::update_video_settings,
            commands::touch::send_tap,
            commands::touch::send_touch_actions,
            commands::touch::send_keys,
            commands::hardware::press_home_button,
            commands::hardware::press_mute_button,
            commands::hardware::press_volume_up,
            commands::hardware::press_volume_down,
            commands::hardware::toggle_lock
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
