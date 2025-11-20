use anyhow::Result;
use core::config::TscannerConfig;
use std::path::{Path, PathBuf};

use core::{get_vscode_extension_id, CONFIG_DIR_NAME, CONFIG_FILE_NAME};

pub fn load_config(root: &Path) -> Result<Option<TscannerConfig>> {
    load_config_with_path(root).map(|opt| opt.map(|(cfg, _)| cfg))
}

pub fn load_config_with_path(root: &Path) -> Result<Option<(TscannerConfig, String)>> {
    let local_path = root.join(CONFIG_DIR_NAME).join(CONFIG_FILE_NAME);
    if local_path.exists() {
        let config =
            TscannerConfig::load_from_file(&local_path).map_err(|e| anyhow::anyhow!("{}", e))?;
        return Ok(Some((config, local_path.display().to_string())));
    }

    if let Some(global_path) = get_vscode_global_config_path(root) {
        if global_path.exists() {
            let config = TscannerConfig::load_from_file(&global_path)
                .map_err(|e| anyhow::anyhow!("{}", e))?;
            return Ok(Some((config, global_path.display().to_string())));
        }
    }

    Ok(None)
}

pub fn get_vscode_global_config_path(root: &Path) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let workspace_hash = compute_workspace_hash(root);

    let vscode_dir = if cfg!(target_os = "windows") {
        home.join("AppData").join("Roaming").join("Code")
    } else if cfg!(target_os = "macos") {
        home.join("Library")
            .join("Application Support")
            .join("Code")
    } else {
        home.join(".config").join("Code")
    };

    let extension_id = get_vscode_extension_id();

    Some(
        vscode_dir
            .join("User")
            .join("globalStorage")
            .join(extension_id)
            .join("configs")
            .join(workspace_hash)
            .join(CONFIG_FILE_NAME),
    )
}

fn compute_workspace_hash(path: &Path) -> String {
    let path_str = path.to_string_lossy();
    let digest = md5::compute(path_str.as_bytes());
    format!("{:x}", digest)[..16].to_string()
}
