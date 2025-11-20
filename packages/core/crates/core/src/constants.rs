use std::env;

pub const APP_NAME: &str = "tscanner";
pub const APP_DISPLAY_NAME: &str = "T Scanner";
pub const APP_DESCRIPTION: &str = "High-performance TypeScript/TSX code quality scanner";

pub const CONFIG_DIR_NAME: &str = ".tscanner";
pub const CONFIG_FILE_NAME: &str = "rules.json";

pub const EXTENSION_PUBLISHER: &str = "lucasvtiradentes";
pub const EXTENSION_NAME: &str = "tscanner-vscode";
pub const EXTENSION_NAME_DEV: &str = "tscanner-vscode-dev";
pub const DEV_SUFFIX: &str = "Dev";

pub const LOG_BASENAME: &str = "tscannerlogs";

pub fn is_dev_mode() -> bool {
    env::var("CI").is_err() && env::var("GITHUB_ACTIONS").is_err()
}

pub fn get_vscode_extension_id() -> String {
    if is_dev_mode() {
        format!("{}.{}", EXTENSION_PUBLISHER, EXTENSION_NAME_DEV)
    } else {
        format!("{}.{}", EXTENSION_PUBLISHER, EXTENSION_NAME)
    }
}

pub fn get_log_filename() -> String {
    if is_dev_mode() {
        format!("{}-dev.txt", LOG_BASENAME)
    } else {
        format!("{}.txt", LOG_BASENAME)
    }
}
