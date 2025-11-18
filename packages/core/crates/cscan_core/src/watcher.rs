use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::Duration;
use tracing::{debug, error};

#[derive(Debug, Clone)]
pub enum FileEvent {
    Modified(PathBuf),
    Created(PathBuf),
    Removed(PathBuf),
}

pub struct FileWatcher {
    _watcher: Box<dyn Watcher>,
    receiver: Receiver<FileEvent>,
}

impl FileWatcher {
    pub fn new(root: &Path) -> Result<Self, notify::Error> {
        let (tx, rx) = channel();

        let mut watcher =
            notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
                Ok(event) => {
                    if let Err(e) = Self::handle_event(event, &tx) {
                        error!("Error handling file event: {}", e);
                    }
                }
                Err(e) => error!("Watch error: {:?}", e),
            })?;

        watcher.watch(root, RecursiveMode::Recursive)?;

        Ok(Self {
            _watcher: Box::new(watcher),
            receiver: rx,
        })
    }

    fn handle_event(
        event: Event,
        tx: &Sender<FileEvent>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for path in event.paths {
            if !Self::should_watch(&path) {
                continue;
            }

            let file_event = match event.kind {
                EventKind::Create(_) => FileEvent::Created(path),
                EventKind::Modify(_) => FileEvent::Modified(path),
                EventKind::Remove(_) => FileEvent::Removed(path),
                _ => continue,
            };

            debug!("File event: {:?}", file_event);
            tx.send(file_event)?;
        }

        Ok(())
    }

    fn should_watch(path: &Path) -> bool {
        if let Some(ext) = path.extension() {
            if ext == "ts" || ext == "tsx" {
                if let Some(parent) = path.parent() {
                    let parent_str = parent.to_string_lossy();
                    return !parent_str.contains("node_modules")
                        && !parent_str.contains(".git")
                        && !parent_str.contains("dist")
                        && !parent_str.contains("build");
                }
                return true;
            }
        }
        false
    }

    pub fn try_recv(&self) -> Option<FileEvent> {
        self.receiver.try_recv().ok()
    }

    pub fn recv_timeout(&self, timeout: Duration) -> Option<FileEvent> {
        self.receiver.recv_timeout(timeout).ok()
    }
}
