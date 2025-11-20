use crate::cache::FileCache;
use crate::config::TscannerConfig;
use crate::disable_comments::DisableDirectives;
use crate::parser::parse_file;
use crate::registry::RuleRegistry;
use crate::types::{FileResult, ScanResult};
use ignore::WalkBuilder;
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tracing::{debug, info};

pub struct Scanner {
    registry: RuleRegistry,
    config: TscannerConfig,
    cache: Arc<FileCache>,
}

impl Scanner {
    pub fn new(config: TscannerConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let registry = RuleRegistry::with_config(&config)?;
        let config_hash = config.compute_hash();
        Ok(Self {
            registry,
            config,
            cache: Arc::new(FileCache::with_config_hash(config_hash)),
        })
    }

    pub fn with_cache(
        config: TscannerConfig,
        cache: Arc<FileCache>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let registry = RuleRegistry::with_config(&config)?;
        Ok(Self {
            registry,
            config,
            cache,
        })
    }

    pub fn scan(&self, root: &Path) -> ScanResult {
        let start = Instant::now();
        info!("Starting scan of {:?}", root);

        let files: Vec<PathBuf> = WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(true)
            .filter_entry(|e| {
                let path = e.path();
                if path.is_dir() {
                    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    return name != "node_modules" && name != ".git" && name != "dist";
                }
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    ext == "ts" || ext == "tsx"
                } else {
                    false
                }
            })
            .build()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .map(|e| e.path().to_path_buf())
            .collect();

        let file_count = files.len();
        info!("Found {} TypeScript files", file_count);

        let processed = AtomicUsize::new(0);
        let cache_hits = AtomicUsize::new(0);

        let results: Vec<FileResult> = files
            .par_iter()
            .filter_map(|path| {
                processed.fetch_add(1, Ordering::Relaxed);

                if let Some(cached_issues) = self.cache.get(path) {
                    cache_hits.fetch_add(1, Ordering::Relaxed);
                    if cached_issues.is_empty() {
                        return None;
                    }
                    return Some(FileResult {
                        file: path.clone(),
                        issues: cached_issues,
                    });
                }

                self.analyze_file(path)
            })
            .filter(|r| !r.issues.is_empty())
            .collect();

        let total_issues: usize = results.iter().map(|r| r.issues.len()).sum();
        let duration = start.elapsed();

        self.cache.flush();

        ScanResult {
            files: results,
            total_issues,
            duration_ms: duration.as_millis(),
        }
    }

    pub fn scan_single(&self, path: &Path) -> Option<FileResult> {
        self.cache.invalidate(path);
        self.analyze_file(path)
    }

    pub fn scan_content(&self, path: &Path, content: &str) -> Option<FileResult> {
        let directives = DisableDirectives::from_source(content);

        if directives.file_disabled {
            return None;
        }

        let program = match parse_file(path, content) {
            Ok(p) => p,
            Err(e) => {
                debug!("Failed to parse {:?}: {}", path, e);
                return None;
            }
        };

        let enabled_rules = self.registry.get_enabled_rules(path, &self.config);
        let source_lines: Vec<&str> = content.lines().collect();

        let issues: Vec<_> = enabled_rules
            .iter()
            .flat_map(|(rule, severity)| {
                let mut rule_issues = rule.check(&program, path, content);
                for issue in &mut rule_issues {
                    issue.severity = *severity;
                    if issue.line > 0 && issue.line <= source_lines.len() {
                        issue.line_text = Some(source_lines[issue.line - 1].to_string());
                    }
                }
                rule_issues
            })
            .filter(|issue| !directives.is_rule_disabled(issue.line, &issue.rule))
            .collect();

        if issues.is_empty() {
            None
        } else {
            Some(FileResult {
                file: path.to_path_buf(),
                issues,
            })
        }
    }

    fn analyze_file(&self, path: &Path) -> Option<FileResult> {
        let source = std::fs::read_to_string(path).ok()?;

        let directives = DisableDirectives::from_source(&source);

        if directives.file_disabled {
            self.cache.insert(path.to_path_buf(), Vec::new());
            return None;
        }

        let program = match parse_file(path, &source) {
            Ok(p) => p,
            Err(e) => {
                debug!("Failed to parse {:?}: {}", path, e);
                return None;
            }
        };

        let enabled_rules = self.registry.get_enabled_rules(path, &self.config);
        let source_lines: Vec<&str> = source.lines().collect();

        let issues: Vec<_> = enabled_rules
            .iter()
            .flat_map(|(rule, severity)| {
                let mut rule_issues = rule.check(&program, path, &source);
                for issue in &mut rule_issues {
                    issue.severity = *severity;
                    if issue.line > 0 && issue.line <= source_lines.len() {
                        issue.line_text = Some(source_lines[issue.line - 1].to_string());
                    }
                }
                rule_issues
            })
            .filter(|issue| !directives.is_rule_disabled(issue.line, &issue.rule))
            .collect();

        self.cache.insert(path.to_path_buf(), issues.clone());

        if issues.is_empty() {
            None
        } else {
            Some(FileResult {
                file: path.to_path_buf(),
                issues,
            })
        }
    }

    pub fn cache(&self) -> Arc<FileCache> {
        self.cache.clone()
    }
}
