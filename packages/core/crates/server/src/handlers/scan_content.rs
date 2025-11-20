use crate::protocol::{Response, ScanContentParams};
use crate::state::ServerState;
use core::{Scanner, TscannerConfig};
use tracing::info;

pub fn handle_scan_content(
    request_id: u64,
    params: ScanContentParams,
    state: &mut ServerState,
) -> Response {
    info!("Scanning content for file: {:?}", params.file);

    let config = if let Some(cfg) = params.config {
        info!("Using config from request params (global storage)");
        cfg
    } else {
        match TscannerConfig::load_from_workspace(&params.root) {
            Ok(c) => {
                info!("Loaded configuration from workspace (.tscanner/rules.json)");
                c
            }
            Err(e) => {
                info!("Using default configuration: {}", e);
                TscannerConfig::default()
            }
        }
    };

    let scanner = match Scanner::with_cache(config, state.cache.clone()) {
        Ok(s) => s,
        Err(e) => {
            return Response {
                id: request_id,
                result: None,
                error: Some(format!("Failed to create scanner: {}", e)),
            }
        }
    };

    match scanner.scan_content(&params.file, &params.content) {
        Some(result) => Response {
            id: request_id,
            result: Some(serde_json::to_value(&result).unwrap()),
            error: None,
        },
        None => Response {
            id: request_id,
            result: Some(serde_json::json!({"file": params.file, "issues": []})),
            error: None,
        },
    }
}
