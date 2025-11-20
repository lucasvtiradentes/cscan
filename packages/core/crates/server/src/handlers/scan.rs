use crate::protocol::{Response, ScanParams};
use crate::state::ServerState;
use core::{FileCache, Scanner, TscannerConfig};
use std::sync::Arc;
use tracing::info;

pub fn handle_scan(request_id: u64, params: ScanParams, state: &mut ServerState) -> Response {
    info!("Scanning workspace: {:?}", params.root);

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

    let config_hash = config.compute_hash();
    info!("Config hash: {}", config_hash);

    let cache = Arc::new(FileCache::with_config_hash(config_hash));
    state.cache = cache.clone();

    let scanner = match Scanner::with_cache(config, cache) {
        Ok(s) => s,
        Err(e) => {
            return Response {
                id: request_id,
                result: None,
                error: Some(format!("Failed to create scanner: {}", e)),
            }
        }
    };

    let result = scanner.scan(&params.root);

    state.scanner = Some(scanner);

    Response {
        id: request_id,
        result: Some(serde_json::to_value(&result).unwrap()),
        error: None,
    }
}
