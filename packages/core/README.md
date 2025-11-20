<a name="TOC"></a>

<div align="center">
<h4>core</h4>
<p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <br>
  <a href="#-overview">Overview</a> • <a href="#-architecture">Architecture</a> • <a href="#-rules">Rules</a> • <a href="#-json-rpc-api">JSON-RPC API</a> • <a href="#-development">Development</a>
</p>

</div>

<a href="#"><img src="https://raw.githubusercontent.com/lucasvtiradentes/tscanner/main/.github/image/divider.png" /></a>

## 🎺 Overview

High-performance Rust engine for validating code patterns, detecting anti-patterns, and enforcing architectural conventions in TypeScript/TSX. Powered by SWC AST analysis, Rayon parallelism, and JSON-RPC for VSCode integration.

<a name="TOC"></a>

## 📦 Crate Structure<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/tscanner/main/.github/image/up_arrow.png" width="22"></a>

This is a Cargo workspace with three crates:

### core (Library)

Core library providing scanner, parser, rules, cache, and config systems.

**Location:** `crates/core/`

**Key Modules:**
```rust
core/
├── lib.rs              // Public API exports
├── types.rs            // Issue, Severity, ScanResult
├── scanner.rs          // Parallel file scanner
├── parser.rs           // SWC TypeScript/TSX parser
├── registry.rs         // Rule registry with inventory
├── cache.rs            // FileCache with DashMap + disk
├── config.rs           // tscannerConfig, RuleConfig
├── watcher.rs          // File system watcher
├── utils.rs            // Line/column utilities
├── ast_utils.rs        // AST helper functions
├── disable_comments.rs // tscanner-disable directives
└── rules/
    ├── mod.rs                      // Rule trait + inventory
    ├── metadata.rs                 // RuleMetadata + categories
    ├── regex_rule.rs               // Regex rule implementation
    ├── no_any_type.rs              // AST visitor for 'any' type
    ├── prefer_const.rs             // Two-phase analysis
    └── ... (20 more rules)
```

### tscanner_server (Binary)

JSON-RPC server for VSCode extension communication.

**Binary name:** `tscanner-server`
**Location:** `crates/tscanner_server/`

### tscanner_cli (Binary - Stub)

Planned standalone CLI tool (currently stub).

**Binary name:** `tscanner`
**Location:** `crates/tscanner_cli/`

## 🏗️ Architecture<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/tscanner/main/.github/image/up_arrow.png" width="22"></a>

### Scanner System

**Parallel File Processing:**
```rust
pub struct Scanner {
    registry: RuleRegistry,
    config: tscannerConfig,
    cache: Arc<FileCache>,
}

impl Scanner {
    pub fn scan(&self, root: &Path) -> ScanResult {
        // 1. File discovery with gitignore support
        let files: Vec<PathBuf> = WalkBuilder::new(root)
            .git_ignore(true)
            .filter_entry(|e| /* skip node_modules, .git */)
            .build()
            .filter_map(|e| e.ok())
            .collect();

        // 2. Parallel processing with Rayon
        let results: Vec<FileResult> = files
            .par_iter()
            .filter_map(|path| {
                // Check cache (mtime + config_hash)
                if let Some(cached) = self.cache.get(path) {
                    return Some(FileResult { file: path, issues: cached });
                }

                // Parse + analyze + cache
                self.analyze_file(path)
            })
            .collect();

        // 3. Flush cache to disk
        self.cache.flush();

        ScanResult { files: results, total_issues, duration_ms }
    }
}
```

**Methods:**
- `scan(root)` - Full workspace scan with caching
- `scan_single(path)` - Re-scan single file (invalidates cache)
- `scan_content(path, content)` - Scan in-memory content (no cache)

### Parser System

**SWC Integration:**
```rust
pub fn parse_file(path: &Path, source: &str) -> Result<Program> {
    let is_tsx = path.extension()
        .and_then(|s| s.to_str())
        .map(|s| s == "tsx")
        .unwrap_or(false);

    let syntax = Syntax::Typescript(TsConfig {
        tsx: is_tsx,
        decorators: true,
        ..Default::default()
    });

    // SWC lexer + parser
    let lexer = Lexer::new(syntax, ...);
    let parser = Parser::new_from(lexer);
    parser.parse_program() // Returns swc_ecma_ast::Program
}
```

### Rule System

**Rule Trait:**
```rust
pub trait Rule: Send + Sync {
    fn name(&self) -> &str;
    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue>;
}
```

**Inventory-based Registration:**
```rust
inventory::submit!(RuleRegistration {
    name: "no-any-type",
    factory: || Arc::new(NoAnyTypeRule),
});
```

Rules are automatically collected at compile time via `inventory::collect!()`.

**Rule Registry:**
```rust
pub struct RuleRegistry {
    rules: HashMap<String, (Arc<dyn Rule>, CompiledRuleConfig)>,
}

impl RuleRegistry {
    pub fn with_config(config: &tscannerConfig) -> Result<Self> {
        let mut rules = HashMap::new();

        // Collect all registered rules
        for reg in inventory::iter::<RuleRegistration>() {
            if let Some(rule_config) = config.rules.get(reg.name) {
                let compiled = config.compile_rule(reg.name)?;
                rules.insert(
                    reg.name.to_string(),
                    ((reg.factory)(), compiled)
                );
            }
        }

        Ok(Self { rules })
    }

    pub fn get_enabled_rules(&self, path: &Path) -> Vec<(&Arc<dyn Rule>, Severity)> {
        self.rules
            .values()
            .filter_map(|(rule, config)| {
                if config.enabled && config.include.is_match(path) {
                    Some((rule, config.severity))
                } else {
                    None
                }
            })
            .collect()
    }
}
```

### Cache System

**Memory Cache:**
```rust
pub struct FileCache {
    entries: DashMap<PathBuf, CacheEntry>,  // Concurrent hash map
    config_hash: u64,
    cache_dir: Option<PathBuf>,
}

#[derive(Clone, Serialize, Deserialize)]
struct CacheEntry {
    mtime: SystemTime,      // File modification time
    config_hash: u64,       // Config hash for invalidation
    issues: Vec<Issue>,
}
```

**Disk Persistence:**
```rust
impl FileCache {
    pub fn with_config_hash(config_hash: u64) -> Self {
        let cache_dir = PathBuf::from(env::var("HOME").unwrap())
            .join(".cache/tscanner");

        let mut cache = Self {
            entries: DashMap::new(),
            config_hash,
            cache_dir: Some(cache_dir.clone()),
        };

        // Load from disk: ~/.cache/tscanner/cache_{config_hash}.json
        cache.load_from_disk(&cache_dir, config_hash);
        cache
    }

    pub fn get(&self, path: &Path) -> Option<Vec<Issue>> {
        let mtime = fs::metadata(path).ok()?.modified().ok()?;

        if let Some(entry) = self.entries.get(path) {
            if entry.mtime == mtime && entry.config_hash == self.config_hash {
                return Some(entry.issues.clone());
            }
        }
        None
    }

    pub fn flush(&self) {
        // Serialize to JSON: Vec<(PathBuf, CacheEntry)>
        self.save_to_disk();
    }
}
```

**Cache Invalidation:**
- File modification time change
- Config hash change (rule updates)
- Manual invalidation (`invalidate(path)`)

### Config System

**Configuration Structure:**
```rust
#[derive(Serialize, Deserialize)]
pub struct tscannerConfig {
    pub rules: HashMap<String, RuleConfig>,
    pub include: Vec<String>,  // Default: ["**/*.{ts,tsx}"]
    pub exclude: Vec<String>,  // Default: ["node_modules/**", "dist/**", ...]
}

#[derive(Serialize, Deserialize)]
pub struct RuleConfig {
    pub enabled: bool,
    pub rule_type: RuleType,        // Ast | Regex
    pub severity: Severity,         // Error | Warning
    pub include: Vec<String>,       // Per-rule patterns
    pub exclude: Vec<String>,
    pub message: Option<String>,
    pub pattern: Option<String>,    // For regex rules
    pub options: HashMap<String, serde_json::Value>,
}
```

**Compiled Config:**
```rust
pub struct CompiledRuleConfig {
    pub enabled: bool,
    pub rule_type: RuleType,
    pub severity: Severity,
    pub include: GlobSet,  // Compiled glob patterns
    pub exclude: GlobSet,
    pub message: Option<String>,
    pub pattern: Option<String>,
    pub options: HashMap<String, serde_json::Value>,
}
```

**Config Hash (Cache Key):**
```rust
impl tscannerConfig {
    pub fn compute_hash(&self) -> u64 {
        let mut hasher = DefaultHasher::new();

        // Sort rules for deterministic hash
        let sorted_rules: BTreeMap<_, _> = self.rules.iter().collect();
        for (name, config) in sorted_rules {
            name.hash(&mut hasher);
            config.enabled.hash(&mut hasher);
            if let Some(pattern) = &config.pattern {
                pattern.hash(&mut hasher);
            }
        }

        hasher.finish()
    }
}
```

**Validation:**
```rust
impl tscannerConfig {
    pub fn validate(&self) -> Result<()> {
        // Check regex patterns
        for (name, rule_config) in &self.rules {
            if rule_config.rule_type == RuleType::Regex {
                if let Some(pattern) = &rule_config.pattern {
                    regex::Regex::new(pattern)?;
                }
            }
        }

        // Check conflicting rules
        let conflicting_pairs = [
            ("prefer-type-over-interface", "prefer-interface-over-type"),
            ("no-relative-imports", "no-absolute-imports"),
        ];

        for (rule1, rule2) in &conflicting_pairs {
            let both_enabled = self.rules.get(*rule1).is_some_and(|r| r.enabled)
                && self.rules.get(*rule2).is_some_and(|r| r.enabled);

            if both_enabled {
                return Err("Conflicting rules enabled".into());
            }
        }

        Ok(())
    }
}
```

### Disable Directives

Supports inline rule disabling:

```typescript
// tscanner-disable-file
// Disables entire file

// tscanner-disable rule1, rule2
const x: any = 5;  // This line is ignored

// tscanner-disable-line rule1
const y: any = 5;  // This line is ignored

// tscanner-disable-next-line rule1
const z: any = 5;  // Next line is ignored
```

**Implementation:**
```rust
pub struct DisableDirectives {
    pub file_disabled: bool,
    disabled_lines: HashMap<usize, HashSet<String>>,
}

impl DisableDirectives {
    pub fn from_source(source: &str) -> Self {
        // Parse comments for directives
        // Returns map: line_number -> set of disabled rule names
    }

    pub fn is_rule_disabled(&self, line: usize, rule: &str) -> bool {
        self.disabled_lines
            .get(&line)
            .map(|rules| rules.is_empty() || rules.contains(rule))
            .unwrap_or(false)
    }
}
```

## 📋 Rules: Pattern Validation & Anti-Pattern Detection<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/tscanner/main/.github/image/up_arrow.png" width="22"></a>

### Complete Rule Inventory (23 Rules)

**Type Safety & Anti-Patterns (3 rules)**
- `no-any-type` - Anti-pattern: Detects `: any` and `as any` type escape hatches (AST)
- `no-implicit-any` - Anti-pattern: Untyped function params with smart inference (AST)
- `prefer-type-over-interface` - Convention: Enforce type aliases over interfaces (AST)

**Variable Conventions (3 rules)**
- `no-var` - Convention: Use let/const instead of var (AST)
- `prefer-const` - Pattern: Detect let variables never reassigned (AST)
- `no-unused-vars` - Anti-pattern: Declared but unused variables (AST)

**Code Quality & Anti-Patterns (7 rules)**
- `no-console-log` - Anti-pattern: Debug console.log() statements (Regex)
- `no-magic-numbers` - Anti-pattern: Hardcoded numeric literals except 0, 1, -1 (AST)
- `no-empty-function` - Anti-pattern: Empty function bodies (AST)
- `no-empty-class` - Anti-pattern: Empty class declarations (AST)
- `no-todo-comments` - Pattern: Detect TODO/FIXME/HACK/XXX/NOTE/BUG markers (Regex)
- `no-nested-ternary` - Anti-pattern: Nested ternary operators reduce readability (AST)
- `max-function-length` - Convention: Max 50 statements per function (AST)

**Import Conventions (6 rules)**
- `no-relative-imports` - Convention: Enforce absolute imports (e.g., @/utils) (AST)
- `no-absolute-imports` - Convention: Enforce relative imports (AST)
- `no-alias-imports` - Convention: Disallow @ prefix imports (AST)
- `no-duplicate-imports` - Anti-pattern: Same module imported multiple times (AST)
- `no-dynamic-import` - Anti-pattern: Disallow dynamic import() calls (AST)
- `no-nested-require` - Convention: Require top-level require() only (AST)

**Bug Prevention (3 rules)**
- `consistent-return` - Return value consistency (AST)
- `no-unreachable-code` - Code after return/throw/break/continue (AST)
- `no-constant-condition` - if/while with constant conditions (AST)

**Style (1 rule)**
- `prefer-interface-over-type` - Prefer interfaces over types (AST)

### Rule Metadata

Each rule has metadata for UI display:

```rust
pub struct RuleMetadata {
    pub name: &'static str,
    pub display_name: &'static str,
    pub description: &'static str,
    pub rule_type: RuleType,
    pub default_severity: Severity,
    pub default_enabled: bool,
    pub category: RuleCategory,
}

pub enum RuleCategory {
    TypeSafety,
    CodeQuality,
    Style,
    Performance,
    BugPrevention,
    Variables,
    Imports,
}
```

### AST Rule Example: no-any-type

```rust
pub struct NoAnyTypeRule;

impl Rule for NoAnyTypeRule {
    fn name(&self) -> &str {
        "no-any-type"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = AnyTypeVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct AnyTypeVisitor<'a> {
    issues: Vec<Issue>,
    path: PathBuf,
    source: &'a str,
}

impl<'a> Visit for AnyTypeVisitor<'a> {
    fn visit_ts_keyword_type(&mut self, n: &TsKeywordType) {
        if matches!(n.kind, TsKeywordTypeKind::TsAnyKeyword) {
            let (line, column) = get_line_col(self.source, n.span().lo.0 as usize);

            self.issues.push(Issue {
                rule: "no-any-type".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: "Found `: any` type annotation".to_string(),
                severity: Severity::Error,
                line_text: None,
            });
        }
        n.visit_children_with(self);
    }
}
```

### Two-Phase Analysis Example: prefer-const

```rust
pub struct PreferConstRule;

impl Rule for PreferConstRule {
    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        // Phase 1: Collect all 'let' declarations
        let mut collector = VariableCollector {
            let_declarations: HashMap::new(),
            source,
        };
        program.visit_with(&mut collector);

        // Phase 2: Track reassignments
        let mut checker = ReassignmentChecker {
            reassigned: HashSet::new(),
        };
        program.visit_with(&mut checker);

        // Analysis: Report 'let' vars never reassigned
        let mut issues = Vec::new();
        for (name, (line, column)) in collector.let_declarations {
            if !checker.reassigned.contains(&name) {
                issues.push(Issue {
                    rule: "prefer-const".to_string(),
                    message: format!("'{}' is never reassigned, use 'const' instead", name),
                    ...
                });
            }
        }
        issues
    }
}
```

## 🔌 JSON-RPC API<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/tscanner/main/.github/image/up_arrow.png" width="22"></a>

### Protocol

**Transport:** Line-delimited JSON over stdin/stdout
**Compression:** GZIP + Base64 encoding (marker: `GZIP:{base64-data}`)

**Request Format:**
```json
{
  "id": 1,
  "method": "scan",
  "params": {
    "root": "/path/to/workspace",
    "config": { ... }
  }
}
```

**Response Format:**
```json
{
  "id": 1,
  "result": { ... },
  "error": null
}
```

**Notification Format (no response expected):**
```json
{
  "method": "file_updated",
  "params": {
    "file": "/path/to/file.ts",
    "issues": [...]
  }
}
```

### Methods

#### scan

Scan workspace with config.

**Request:**
```json
{
  "id": 1,
  "method": "scan",
  "params": {
    "root": "/workspace",
    "config": {
      "rules": {
        "no-any-type": {
          "enabled": true,
          "type": "ast",
          "severity": "error"
        }
      },
      "include": ["**/*.ts"],
      "exclude": ["node_modules/**"]
    }
  }
}
```

**Response:**
```json
{
  "id": 1,
  "result": {
    "files": [
      {
        "file": "/workspace/src/index.ts",
        "issues": [
          {
            "rule": "no-any-type",
            "file": "/workspace/src/index.ts",
            "line": 5,
            "column": 10,
            "message": "Found ': any' type annotation",
            "severity": "error",
            "line_text": "const x: any = 5;"
          }
        ]
      }
    ],
    "total_issues": 1,
    "duration_ms": 234
  }
}
```

#### scanFile

Re-scan single file (invalidates cache).

**Request:**
```json
{
  "id": 2,
  "method": "scanFile",
  "params": {
    "root": "/workspace",
    "file": "/workspace/src/index.ts"
  }
}
```

#### scanContent

Scan in-memory content (no cache).

**Request:**
```json
{
  "id": 3,
  "method": "scanContent",
  "params": {
    "root": "/workspace",
    "file": "/workspace/src/index.ts",
    "content": "const x: any = 5;",
    "config": { ... }
  }
}
```

#### getRulesMetadata

Get all available rules with metadata.

**Request:**
```json
{
  "id": 4,
  "method": "getRulesMetadata",
  "params": {}
}
```

**Response:**
```json
{
  "id": 4,
  "result": [
    {
      "name": "no-any-type",
      "displayName": "No Any Type",
      "description": "Detects usage of TypeScript 'any' type",
      "ruleType": "ast",
      "defaultSeverity": "error",
      "defaultEnabled": false,
      "category": "typesafety"
    }
  ]
}
```

#### clearCache

Clear memory cache.

**Request:**
```json
{
  "id": 5,
  "method": "clearCache",
  "params": {}
}
```

### File Watcher

After creating a watcher with `watch` method, the server sends notifications for file events:

```json
{
  "method": "file_updated",
  "params": {
    "file": "/workspace/src/index.ts",
    "issues": [...]
  }
}
```

## 🔧 Development<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/tscanner/main/.github/image/up_arrow.png" width="22"></a>

### Build Commands

```bash
cargo build                     # Build debug
cargo build --release           # Build optimized
cargo test                      # Run tests
cargo watch -x build            # Auto-rebuild on change
```

### Running the Server

```bash
cargo run --bin tscanner-server
```

Then send JSON-RPC requests via stdin:

```bash
echo '{"id":1,"method":"scan","params":{"root":"."}}' | cargo run --bin tscanner-server
```

### Adding a New Rule

1. Create `crates/core/src/rules/my_rule.rs`:

```rust
use crate::rules::{Rule, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::Program;
use swc_ecma_visit::{Visit, VisitWith};

pub struct MyRule;

inventory::submit!(RuleRegistration {
    name: "my-rule",
    factory: || Arc::new(MyRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "my-rule",
        display_name: "My Rule",
        description: "Custom rule description",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::CodeQuality,
    }
});

impl Rule for MyRule {
    fn name(&self) -> &str {
        "my-rule"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = MyVisitor { issues: Vec::new(), ... };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct MyVisitor { ... }

impl Visit for MyVisitor {
    // Implement visitor methods
}
```

2. Add to `crates/core/src/rules/mod.rs`:

```rust
mod my_rule;
```

3. Rebuild - rule is automatically registered via `inventory`.

### Dependencies

**SWC Ecosystem:**
- `swc_ecma_parser` v27 - TypeScript/JavaScript parser
- `swc_ecma_ast` v18 - AST definitions
- `swc_ecma_visit` v18 - Visitor pattern
- `swc_common` v17 - Shared utilities, source maps

**Concurrency:**
- `rayon` v1.11 - Data parallelism
- `dashmap` v6.1 - Concurrent hash map

**File Operations:**
- `walkdir` v2.5 - Directory traversal
- `ignore` v0.4 - .gitignore support
- `globset` v0.4 - Glob pattern matching
- `notify` v8 - File system watching

**Serialization:**
- `serde` v1.0 - Serialization framework
- `serde_json` v1.0 - JSON support

**Other:**
- `regex` v1.11 - Regex matching
- `anyhow` v1.0 - Error handling
- `thiserror` v2.0 - Error derive macros
- `tracing` v0.1 - Structured logging
- `inventory` v0.3 - Compile-time registration
- `flate2` v1.0 - GZIP compression
- `base64` v0.21 - Base64 encoding

### Release Profile

Aggressive optimization for production builds:

```toml
[profile.release]
opt-level = 3           # Maximum optimization
lto = true              # Link-time optimization
codegen-units = 1       # Single codegen unit for better optimization
strip = true            # Strip debug symbols
```

## 📜 License<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/tscanner/main/.github/image/up_arrow.png" width="22"></a>

MIT License - see [LICENSE](../../LICENSE) file for details.
