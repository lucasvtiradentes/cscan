use crate::protocol::{Response, ScanFileParams};
use crate::state::ServerState;
use core::{Scanner, TscannerConfig};
use tracing::info;

pub fn handle_scan_file(
    request_id: u64,
    params: ScanFileParams,
    state: &mut ServerState,
) -> Response {
    info!("Scanning single file: {:?}", params.file);

    let config = TscannerConfig::load_from_workspace(&params.root).unwrap_or_default();

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

    state.scanner = Some(scanner);

    match state
        .scanner
        .as_ref()
        .and_then(|s| s.scan_single(&params.file))
    {
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
