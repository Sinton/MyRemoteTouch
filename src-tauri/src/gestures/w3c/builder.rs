use serde_json::{json, Value};
use crate::gestures::types::TouchPoint;

/// W3C Actions JSON 构建器
pub struct W3cActionsBuilder;

impl W3cActionsBuilder {
    /// 构建点击 Actions
    pub fn tap(x: i64, y: i64) -> Value {
        json!({
            "actions": [{
                "type": "pointer",
                "id": "finger1",
                "parameters": { "pointerType": "touch" },
                "actions": [
                    { "type": "pointerMove", "duration": 0, "x": x, "y": y },
                    { "type": "pointerDown", "button": 0 },
                    { "type": "pointerUp", "button": 0 }
                ]
            }]
        })
    }
    
    /// 构建双击 Actions
    pub fn double_tap(x: i64, y: i64) -> Value {
        json!({
            "actions": [{
                "type": "pointer",
                "id": "finger1",
                "parameters": { "pointerType": "touch" },
                "actions": [
                    { "type": "pointerMove", "duration": 0, "x": x, "y": y },
                    { "type": "pointerDown", "button": 0 },
                    { "type": "pointerUp", "button": 0 },
                    { "type": "pause", "duration": 100 },
                    { "type": "pointerDown", "button": 0 },
                    { "type": "pointerUp", "button": 0 }
                ]
            }]
        })
    }
    
    /// 构建长按 Actions
    pub fn long_press(x: i64, y: i64, duration_ms: u64) -> Value {
        json!({
            "actions": [{
                "type": "pointer",
                "id": "finger1",
                "parameters": { "pointerType": "touch" },
                "actions": [
                    { "type": "pointerMove", "duration": 0, "x": x, "y": y },
                    { "type": "pointerDown", "button": 0 },
                    { "type": "pause", "duration": duration_ms },
                    { "type": "pointerUp", "button": 0 }
                ]
            }]
        })
    }
    
    /// 构建拖拽 Actions
    pub fn drag(from_x: i64, from_y: i64, to_x: i64, to_y: i64, duration_ms: u64) -> Value {
        json!({
            "actions": [{
                "type": "pointer",
                "id": "finger1",
                "parameters": { "pointerType": "touch" },
                "actions": [
                    { "type": "pointerMove", "duration": 0, "x": from_x, "y": from_y },
                    { "type": "pointerDown", "button": 0 },
                    { "type": "pause", "duration": 250 },  // 长按识别
                    { "type": "pointerMove", "duration": duration_ms, "x": to_x, "y": to_y },
                    { "type": "pointerUp", "button": 0 }
                ]
            }]
        })
    }
    
    /// 构建复杂路径滑动 Actions（使用智能采样）
    pub fn swipe_path(points: &[TouchPoint]) -> Value {
        if points.is_empty() {
            return json!({ "actions": [] });
        }
        
        let start = &points[0];
        let end = &points[points.len() - 1];
        
        let start_x = start.x.round() as i64;
        let start_y = start.y.round() as i64;
        let end_x = end.x.round() as i64;
        let end_y = end.y.round() as i64;
        
        // 计算总时长和距离
        let total_duration = (end.time.saturating_sub(start.time)).clamp(100, 1000);
        let dx = (end_x - start_x) as f64;
        let dy = (end_y - start_y) as f64;
        let distance = (dx * dx + dy * dy).sqrt();
        
        let mut pointer_actions = Vec::new();
        
        // 移动到起点
        pointer_actions.push(json!({ "type": "pointerMove", "duration": 0, "x": start_x, "y": start_y }));
        pointer_actions.push(json!({ "type": "pointerDown", "button": 0 }));
        
        // 判断是否为拖拽
        let is_drag = total_duration > 300 || distance > 100.0;
        if is_drag {
            pointer_actions.push(json!({ "type": "pause", "duration": 250 }));
        }
        
        // 对于复杂路径，添加中间点
        if points.len() > 3 && distance > 100.0 {
            let sampled_points = Self::sample_key_points(points, 5);
            
            for point in sampled_points {
                let x = point.x.round() as i64;
                let y = point.y.round() as i64;
                let duration = ((point.time - start.time) as f64 * 0.8) as u64;
                pointer_actions.push(json!({ 
                    "type": "pointerMove", 
                    "duration": duration.clamp(10, 100),
                    "x": x, 
                    "y": y 
                }));
            }
        }
        
        // 移动到终点
        let final_duration = if total_duration < 300 && distance > 50.0 {
            total_duration.min(200)  // 快速滑动
        } else {
            total_duration
        };
        
        pointer_actions.push(json!({ "type": "pointerMove", "duration": final_duration, "x": end_x, "y": end_y }));
        pointer_actions.push(json!({ "type": "pointerUp", "button": 0 }));
        
        json!({
            "actions": [{
                "type": "pointer",
                "id": "finger1",
                "parameters": { "pointerType": "touch" },
                "actions": pointer_actions
            }]
        })
    }
    
    /// 智能采样关键路径点
    fn sample_key_points(points: &[TouchPoint], max_points: usize) -> Vec<TouchPoint> {
        if points.len() <= max_points + 2 {
            return points[1..points.len()-1].to_vec();
        }
        
        let start = &points[0];
        let end = &points[points.len() - 1];
        
        let mut distances: Vec<(usize, f64)> = points[1..points.len()-1]
            .iter()
            .enumerate()
            .map(|(i, point)| {
                let distance = Self::point_to_line_distance(point, start, end);
                (i + 1, distance)
            })
            .collect();
        
        distances.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        let mut selected_indices: Vec<usize> = distances
            .iter()
            .take(max_points)
            .map(|(idx, _)| *idx)
            .collect();
        selected_indices.sort();
        
        selected_indices.iter().map(|&i| points[i].clone()).collect()
    }
    
    /// 计算点到直线的距离
    fn point_to_line_distance(point: &TouchPoint, line_start: &TouchPoint, line_end: &TouchPoint) -> f64 {
        let dx = line_end.x - line_start.x;
        let dy = line_end.y - line_start.y;
        let line_length_sq = dx * dx + dy * dy;
        
        if line_length_sq < 1.0 {
            let px = point.x - line_start.x;
            let py = point.y - line_start.y;
            return (px * px + py * py).sqrt();
        }
        
        let t = ((point.x - line_start.x) * dx + (point.y - line_start.y) * dy) / line_length_sq;
        let t = t.clamp(0.0, 1.0);
        
        let proj_x = line_start.x + t * dx;
        let proj_y = line_start.y + t * dy;
        
        let dist_x = point.x - proj_x;
        let dist_y = point.y - proj_y;
        
        (dist_x * dist_x + dist_y * dist_y).sqrt()
    }
}
