use serde_json::json;
use crate::error::AppResult;
use crate::wda_client::WdaClient;

#[tauri::command]
pub async fn press_volume_up(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/pressButton", sid));
    wda.get_client().post(url).json(&json!({ "name": "volumeup" })).send().await?;
    Ok(())
}

#[tauri::command]
pub async fn press_volume_down(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/pressButton", sid));
    wda.get_client().post(url).json(&json!({ "name": "volumedown" })).send().await?;
    Ok(())
}

#[tauri::command]
pub async fn toggle_lock(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    let res = wda.get_client().post(format!("{}/session/{}/wda/lock", base_url, sid)).send().await;
    let mut success = false;
    if let Ok(r) = res {
        if r.status().is_success() { success = true; }
    }
    if !success {
        wda.get_client().post(format!("{}/session/{}/wda/pressButton", base_url, sid))
            .json(&json!({ "name": "power" })).send().await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn press_home_button(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    let _ = wda.get_client().post(format!("{}/wda/homescreen", base_url)).send().await;
    wda.get_client().post(format!("{}/session/{}/wda/pressButton", base_url, sid))
        .json(&json!({ "name": "home" })).send().await?;
    Ok(())
}

#[tauri::command]
pub async fn press_mute_button(wda: tauri::State<'_, WdaClient>) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let base_url = wda.format_url("");
    for key_name in &["muteswitch", "mute", "muteswitchtoggle"] {
        let res = wda.get_client().post(format!("{}/session/{}/wda/pressButton", base_url, sid))
            .json(&json!({ "name": key_name }))
            .send()
            .await;
        if let Ok(r) = res {
            if r.status().is_success() { break; }
        }
    }
    Ok(())
}
