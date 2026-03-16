use std::sync::Arc;
use super::types::GestureStrategy;
use super::traits::{
    TapGesture,
    SwipeGesture,
    DragGesture,
    LongPressGesture,
    DoubleTapGesture,
};
use super::wda;
use super::w3c;

/// 手势工厂
pub struct GestureFactory;

impl GestureFactory {
    /// 创建点击手势
    pub fn create_tap(strategy: GestureStrategy) -> Arc<dyn TapGesture> {
        match strategy {
            GestureStrategy::WDA | GestureStrategy::Auto => {
                Arc::new(wda::WdaTap)
            }
            GestureStrategy::W3C => {
                Arc::new(w3c::W3cTap)
            }
        }
    }
    
    /// 创建滑动手势
    pub fn create_swipe(strategy: GestureStrategy) -> Arc<dyn SwipeGesture> {
        match strategy {
            GestureStrategy::WDA | GestureStrategy::Auto => {
                Arc::new(wda::WdaSwipe)
            }
            GestureStrategy::W3C => {
                Arc::new(w3c::W3cSwipe)
            }
        }
    }
    
    /// 创建拖拽手势
    pub fn create_drag(strategy: GestureStrategy) -> Arc<dyn DragGesture> {
        match strategy {
            GestureStrategy::WDA | GestureStrategy::Auto => {
                Arc::new(wda::WdaDrag)
            }
            GestureStrategy::W3C => {
                Arc::new(w3c::W3cDrag)
            }
        }
    }
    
    /// 创建长按手势
    pub fn create_long_press(strategy: GestureStrategy) -> Arc<dyn LongPressGesture> {
        match strategy {
            GestureStrategy::WDA | GestureStrategy::Auto => {
                Arc::new(wda::WdaLongPress)
            }
            GestureStrategy::W3C => {
                Arc::new(w3c::W3cLongPress)
            }
        }
    }
    
    /// 创建双击手势
    pub fn create_double_tap(strategy: GestureStrategy) -> Arc<dyn DoubleTapGesture> {
        match strategy {
            GestureStrategy::WDA | GestureStrategy::Auto => {
                Arc::new(wda::WdaDoubleTap)
            }
            GestureStrategy::W3C => {
                Arc::new(w3c::W3cDoubleTap)
            }
        }
    }
}
