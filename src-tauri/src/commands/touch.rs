use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::error::AppResult;
use crate::wda_client::WdaClient;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TouchPoint {
    pub x: u32,
    pub y: u32,
    pub time: u64,
}

#[tauri::command]
pub async fn send_touch_actions(wda: tauri::State<'_, WdaClient>, actions: Vec<TouchPoint>) -> AppResult<()> {
    if actions.is_empty() { return Ok(()); }
    let sid = wda.get_session_id().await;
    let mut pointer_actions = Vec::new();
    
    let start = &actions[0];
    pointer_actions.push(json!({ "type": "pointerMove", "duration": 0, "x": start.x, "y": start.y }));
    pointer_actions.push(json!({ "type": "pointerDown", "button": 0 }));
    
    let mut last_time = start.time;
    for i in 1..actions.len() {
        let point = &actions[i];
        let mut duration = point.time.saturating_sub(last_time);
        if duration > 500 { duration = 500; }
        pointer_actions.push(json!({ "type": "pointerMove", "duration": duration, "x": point.x, "y": point.y }));
        last_time = point.time;
    }
    pointer_actions.push(json!({ "type": "pointerUp", "button": 0 }));
    
    let w3c_body = json!({
        "actions": [{
            "type": "pointer",
            "id": "finger1",
            "parameters": { "pointerType": "touch" },
            "actions": pointer_actions
        }]
    });
    
    let url = wda.format_url(&format!("/session/{}/actions", sid));
    wda.get_client().post(&url).json(&w3c_body).send().await?;
    Ok(())
}

#[tauri::command]
pub async fn send_tap(wda: tauri::State<'_, WdaClient>, x: u32, y: u32) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let w3c_body = json!({
        "actions": [{
            "type": "pointer",
            "id": "finger1",
            "parameters": { "pointerType": "touch" },
            "actions": [
                { "type": "pointerMove", "duration": 0, "x": x, "y": y },
                { "type": "pointerDown", "button": 0 },
                { "type": "pause", "duration": 50 },
                { "type": "pointerUp", "button": 0 }
            ]
        }]
    });
    
    let url_actions = wda.format_url(&format!("/session/{}/actions", sid));
    wda.get_client().post(&url_actions).json(&w3c_body).send().await?;
    Ok(())
}

#[tauri::command]
pub async fn send_keys(wda: tauri::State<'_, WdaClient>, key: String) -> AppResult<()> {
    let sid = wda.get_session_id().await;
    let url = wda.format_url(&format!("/session/{}/wda/keys", sid));
    wda.get_client().post(url).json(&json!({ "value": [key] })).send().await?;
    Ok(())
}
