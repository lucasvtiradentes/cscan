use crate::types::Issue;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tracing::info;

#[derive(Clone, Serialize, Deserialize)]
struct CacheEntry {
    #[serde(with = "systemtime_serde")]
    mtime: SystemTime,
    config_hash: u64,
    issues: Vec<Issue>,
}

mod systemtime_serde {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use std::time::{SystemTime, UNIX_EPOCH};

    pub fn serialize<S>(time: &SystemTime, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let duration = time.duration_since(UNIX_EPOCH).unwrap();
        duration.as_secs().serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<SystemTime, D::Error>
    where
        D: Deserializer<'de>,
    {
        let secs = u64::deserialize(deserializer)?;
        Ok(UNIX_EPOCH + std::time::Duration::from_secs(secs))
    }
}

pub struct FileCache {
    entries: DashMap<PathBuf, CacheEntry>,
    config_hash: u64,
    cache_dir: Option<PathBuf>,
}

impl Default for FileCache {
    fn default() -> Self {
        Self::new()
    }
}

impl FileCache {
    pub fn new() -> Self {
        Self {
            entries: DashMap::new(),
            config_hash: 0,
            cache_dir: Self::get_cache_dir(),
        }
    }

    pub fn with_config_hash(config_hash: u64) -> Self {
        let cache_dir = Self::get_cache_dir();
        let mut cache = Self {
            entries: DashMap::new(),
            config_hash,
            cache_dir: cache_dir.clone(),
        };

        if let Some(dir) = cache_dir {
            cache.load_from_disk(&dir, config_hash);
        }

        cache
    }

    fn get_cache_dir() -> Option<PathBuf> {
        let home = std::env::var("HOME").ok()?;
        let cache_dir = PathBuf::from(home).join(".cache/cscanner");
        fs::create_dir_all(&cache_dir).ok()?;
        Some(cache_dir)
    }

    fn load_from_disk(&mut self, cache_dir: &Path, config_hash: u64) {
        let cache_file = cache_dir.join(format!("cache_{}.json", config_hash));

        if !cache_file.exists() {
            return;
        }

        match fs::read_to_string(&cache_file) {
            Ok(content) => match serde_json::from_str::<Vec<(PathBuf, CacheEntry)>>(&content) {
                Ok(entries) => {
                    let mut loaded = 0;
                    for (path, entry) in entries {
                        if entry.config_hash == config_hash {
                            self.entries.insert(path, entry);
                            loaded += 1;
                        }
                    }
                    info!("Loaded {} cache entries", loaded);
                }
                Err(e) => info!("Failed to parse cache: {}", e),
            },
            Err(e) => info!("Failed to read cache: {}", e),
        }
    }

    fn save_to_disk(&self) {
        if let Some(cache_dir) = &self.cache_dir {
            let cache_file = cache_dir.join(format!("cache_{}.json", self.config_hash));

            let entries: Vec<(PathBuf, CacheEntry)> = self
                .entries
                .iter()
                .map(|entry| (entry.key().clone(), entry.value().clone()))
                .collect();

            if let Ok(content) = serde_json::to_string(&entries) {
                if let Err(e) = fs::write(&cache_file, &content) {
                    info!("Failed to save cache: {}", e);
                } else {
                    info!("Saved {} cache entries", entries.len());
                }
            }
        }
    }

    pub fn get(&self, path: &Path) -> Option<Vec<Issue>> {
        let metadata = fs::metadata(path).ok()?;
        let mtime = metadata.modified().ok()?;

        if let Some(entry) = self.entries.get(path) {
            let cached_secs = entry
                .mtime
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            let current_secs = mtime
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            if cached_secs == current_secs && entry.config_hash == self.config_hash {
                return Some(entry.issues.clone());
            }
        }

        None
    }

    pub fn insert(&self, path: PathBuf, issues: Vec<Issue>) {
        if let Ok(metadata) = fs::metadata(&path) {
            if let Ok(mtime) = metadata.modified() {
                self.entries.insert(
                    path,
                    CacheEntry {
                        mtime,
                        config_hash: self.config_hash,
                        issues: issues.clone(),
                    },
                );
            }
        }
    }

    pub fn invalidate(&self, path: &Path) {
        self.entries.remove(path);
    }

    pub fn clear(&self) {
        self.entries.clear();
        if let Some(cache_dir) = &self.cache_dir {
            let cache_file = cache_dir.join(format!("cache_{}.json", self.config_hash));
            let _ = std::fs::remove_file(&cache_file);
        }
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn flush(&self) {
        self.save_to_disk();
    }
}
