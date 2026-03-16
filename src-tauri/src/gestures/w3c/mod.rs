pub mod builder;
pub mod tap;
pub mod swipe;
pub mod drag;
pub mod long_press;
pub mod double_tap;

pub(crate) use builder::W3cActionsBuilder;
pub use tap::W3cTap;
pub use swipe::W3cSwipe;
pub use drag::W3cDrag;
pub use long_press::W3cLongPress;
pub use double_tap::W3cDoubleTap;
