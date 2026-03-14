use serde::{Deserialize, Serialize};
use crate::error::AppResult;
use crate::wda_client::{WdaClient, WdaResponse};

#[derive(Serialize, Deserialize, Debug)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn get_window_size(wda: tauri::State<'_, WdaClient>) -> AppResult<WindowSize> {
    println!("正在获取设备分辨率...");
    let url = wda.format_url("/window/size");
    let res = wda.get_client().get(&url).send().await?;
    let body = res.json::<WdaResponse<WindowSize>>().await?;
    println!("同步到设备分辨率: {}x{}", body.value.width, body.value.height);
    Ok(body.value)
}
