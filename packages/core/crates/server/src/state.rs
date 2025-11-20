use core::{FileCache, FileWatcher, Scanner};
use std::sync::Arc;

pub struct ServerState {
    pub scanner: Option<Scanner>,
    pub watcher: Option<FileWatcher>,
    pub cache: Arc<FileCache>,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            scanner: None,
            watcher: None,
            cache: Arc::new(FileCache::new()),
        }
    }
}
