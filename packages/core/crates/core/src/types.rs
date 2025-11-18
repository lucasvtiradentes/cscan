use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub rule: String,
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub message: String,
    pub severity: Severity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileResult {
    pub file: PathBuf,
    pub issues: Vec<Issue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub files: Vec<FileResult>,
    pub total_issues: usize,
    pub duration_ms: u128,
}
