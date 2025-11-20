use crate::protocol::{Response, WatchParams};
use crate::state::ServerState;
use core::FileWatcher;
use tracing::info;

pub fn handle_watch(request_id: u64, params: WatchParams, state: &mut ServerState) -> Response {
    info!("Starting file watcher: {:?}", params.root);

    match FileWatcher::new(&params.root) {
        Ok(watcher) => {
            state.watcher = Some(watcher);
            Response {
                id: request_id,
                result: Some(serde_json::json!({"status": "watching"})),
                error: None,
            }
        }
        Err(e) => Response {
            id: request_id,
            result: None,
            error: Some(format!("Failed to start watcher: {}", e)),
        },
    }
}
