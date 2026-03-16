use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("WDA connection failed: {0}")]
    WdaConnection(String),

    #[error("WDA error: {0}")]
    Wda(String),

    #[error("WDA session error: {0}")]
    WdaSession(String),

    #[error("Device not found")]
    DeviceNotFound,

    #[error("Device proxy error: {0}")]
    ProxyError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Session expired")]
    SessionExpired,
    
    #[error("Video stream error: {0}")]
    VideoStream(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Health check failed: {0}")]
    HealthCheck(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
