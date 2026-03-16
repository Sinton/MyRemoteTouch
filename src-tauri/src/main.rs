// Prevents additional console window on Windows in release, do not remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tracing::info;
use tracing_subscriber;

mod config;
mod app_state;
mod clients;
mod services;
mod video;
mod gestures;
pub mod error;
pub mod commands;

use crate::config::AppConfig;
use crate::app_state::AppState;
use crate::services::{VideoService, HealthService};
use std::sync::Arc;

fn main() {
    // 初始化日志系统
    tracing_subscriber::fmt()
        .with_max_level(if cfg!(debug_assertions) {
            tracing::Level::DEBUG
        } else {
            tracing::Level::INFO
        })
        .with_target(false)
        .with_thread_ids(false)
        .init();

    info!("MyRemoteTouch 正在启动...");

    // 加载配置
    let config = AppConfig::default();
    info!("配置加载完成");

    // 创建应用状态
    let app_state = Arc::new(AppState::new(config.clone()));
    
    // 克隆用于不同闭包
    let setup_state = Arc::clone(&app_state);
    let window_state = Arc::clone(&app_state);

    tauri::Builder::default()
        // 注册状态到 Tauri
        .manage(Arc::clone(app_state.wda_client()))
        .manage(Arc::clone(app_state.streaming_state()))
        .manage(Arc::clone(app_state.device_manager()))
        .manage(Arc::clone(&app_state))
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let handle = app.handle().clone();
            
            // 初始化代理服务
            info!("初始化 iOS 代理服务...");
            Arc::clone(setup_state.proxy_manager()).init_proxies(handle.clone());
            
            // 启动视频服务
            let video_service = VideoService::new(
                config.video.clone(),
                Arc::clone(setup_state.streaming_state()),
            );
            let video_token = setup_state.cancel_token().clone();
            tauri::async_runtime::spawn(async move {
                info!("启动视频流服务...");
                video_service.start(video_token).await;
            });

            // 启动健康检查服务
            let health_service = HealthService::new(
                Arc::clone(setup_state.wda_client()),
                Arc::clone(setup_state.device_manager()),
                config.health.clone(),
            );
            let health_token = setup_state.cancel_token().clone();
            tauri::async_runtime::spawn(async move {
                info!("启动健康检查服务...");
                health_service.start(health_token).await;
            });

            Ok(())
        })
        .on_window_event(move |_, event| {
            if let tauri::WindowEvent::Destroyed = event {
                info!("窗口关闭，正在清理资源...");
                window_state.shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::device::get_window_size,
            commands::device::update_video_settings,
            commands::device::update_video_settings_with_scale,
            commands::device::get_wda_settings,
            commands::device::set_video_active,
            commands::device::diagnose_wda_connection,
            // 触控操作
            commands::touch::send_tap,
            commands::touch::send_double_tap,
            commands::touch::send_long_press,
            commands::touch::send_swipe,
            commands::touch::send_swipe_path,
            commands::touch::send_drag,
            commands::touch::send_touch_actions,  // 兼容旧 API
            commands::touch::send_keys,
            // 硬件按键
            commands::hardware::press_home_button,
            commands::hardware::press_mute_button,
            commands::hardware::press_volume_up,
            commands::hardware::press_volume_down,
            commands::hardware::toggle_lock
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
    info!("应用已退出");
}
