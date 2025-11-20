use core::TscannerConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: u64,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub id: u64,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Notification {
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ScanParams {
    pub root: PathBuf,
    pub config: Option<TscannerConfig>,
}

#[derive(Debug, Deserialize)]
pub struct WatchParams {
    pub root: PathBuf,
}

#[derive(Debug, Deserialize)]
pub struct ScanFileParams {
    pub root: PathBuf,
    pub file: PathBuf,
}

#[derive(Debug, Deserialize)]
pub struct ScanContentParams {
    pub root: PathBuf,
    pub file: PathBuf,
    pub content: String,
    pub config: Option<TscannerConfig>,
}
