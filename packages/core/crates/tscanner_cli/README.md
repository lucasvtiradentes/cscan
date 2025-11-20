# tscanner CLI

Standalone command-line interface for tscanner, the high-performance TypeScript/TSX code quality scanner.

## Installation

### From Source

```bash
cd packages/core
cargo build --release --bin tscanner
cp target/release/tscanner /usr/local/bin/
```

### Cross-Platform Binaries

Available platforms:
- `tscanner-x86_64-unknown-linux-gnu` (Linux x86_64)
- `tscanner-aarch64-unknown-linux-gnu` (Linux ARM64)
- `tscanner-x86_64-apple-darwin` (macOS Intel)
- `tscanner-aarch64-apple-darwin` (macOS Apple Silicon)
- `tscanner-x86_64-pc-windows-msvc.exe` (Windows x64)

## Usage

### Initialize Configuration

Create a default `.tscanner/rules.json` configuration file:

```bash
tscanner init
tscanner init /path/to/project
```

### Check Code Quality

Scan files and report issues:

```bash
tscanner check
tscanner check /path/to/project
tscanner check --no-cache
```

Exit codes:
- `0` - No errors (warnings allowed)
- `1` - Errors found or configuration missing

### List Rules

Display all configured rules:

```bash
tscanner rules
tscanner rules /path/to/project
```

Shows:
- Enabled/disabled status
- Rule type (AST/Regex)
- Severity level (Error/Warning)
- Custom messages
- Pattern definitions

## Configuration Resolution

tscanner searches for configuration in this priority order:

1. **Local Project Config** (recommended)
   - `.tscanner/rules.json` in project root
   - User-managed, version-controlled

2. **VSCode Global Config** (compatibility mode)
   - `~/.vscode/extensions/.tscanner-config-{hash}.json`
   - Auto-managed by VSCode extension
   - Hash based on workspace path (MD5)

If no configuration is found, tscanner exits with an error and helpful message.

## Configuration File

`.tscanner/rules.json` format:

```json
{
  "rules": {
    "no-any-type": {
      "enabled": true,
      "type": "ast",
      "severity": "error",
      "include": [],
      "exclude": [],
      "message": null
    },
    "custom-todo-pattern": {
      "enabled": true,
      "type": "regex",
      "severity": "warning",
      "pattern": "TODO:|FIXME:",
      "message": "Found TODO comment",
      "include": ["**/*.ts"],
      "exclude": []
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**"
  ]
}
```

## Examples

### Basic Workflow

```bash
cd my-typescript-project

tscanner init

tscanner check
```

### CI/CD Integration

```bash
#!/bin/bash
set -e

tscanner check || {
  echo "tscanner found code quality issues"
  exit 1
}

echo "Code quality checks passed!"
```

### Pre-commit Hook

```bash
#!/bin/sh

if ! command -v tscanner &> /dev/null; then
  echo "tscanner not installed, skipping checks"
  exit 0
fi

if [ ! -f .tscanner/rules.json ]; then
  echo "No tscanner config found, skipping checks"
  exit 0
fi

tscanner check --no-cache
```

## Output Format

### Check Command

```
Scanning...

src/index.ts
  ✖ 5:10 Found ': any' type annotation [no-any-type]
    const x: any = 5;
  ⚠ 10:7 'count' is never reassigned, use 'const' instead [prefer-const]
    let count = 0;

src/utils.ts
  ✖ 3:1 console.log() statement found [no-console-log]
    console.log('debug');

✖ 2 errors, 1 warnings
Scanned 2 files in 45ms
```

### Rules Command

```
tscanner Rules Configuration
Config: /home/user/project/.tscanner/rules.json

23 enabled rules:

  • no-any-type [AST] ERROR
  • prefer-const [AST] WARN
    Variables never reassigned should use 'const'
  • no-console-log [REGEX] ERROR
    Pattern: console\.log\(

5 disabled rules
```

## Performance

**Caching:**
- File-level cache stored in `~/.cache/tscanner/`
- Cache key: `cache_{config_hash}.json`
- Invalidated on file change or config update
- Use `--no-cache` to bypass

**Parallel Processing:**
- Rayon-powered multi-core file analysis
- Scales with available CPU cores
- Typical scan: 100-500 files in <1 second

## Environment Variables

```bash
RUST_LOG=core=debug,tscanner_cli=debug tscanner check
```

Log levels: `error`, `warn`, `info`, `debug`, `trace`

## Differences from VSCode Extension

| Feature | CLI | VSCode Extension |
|---------|-----|------------------|
| Config Source | Project or VSCode global | Project or VSCode global |
| Git Integration | ❌ No branch mode | ✅ Branch-based scanning |
| File Watching | ❌ Manual scan only | ✅ Auto re-scan on change |
| UI | Terminal output | Tree/List view sidebar |
| Navigation | ❌ No jump-to-issue | ✅ Click to navigate |
| Use Case | CI/CD, pre-commit | Interactive development |

## Troubleshooting

**No configuration found:**
```bash
tscanner init
```

**Slow scans:**
```bash
tscanner check --no-cache
```

**Enable debug logs:**
```bash
RUST_LOG=debug tscanner check
```

## Development

Build from source:

```bash
cd packages/core
cargo build --bin tscanner
cargo run --bin tscanner -- check
```

Run tests:

```bash
cargo test --bin tscanner
```

## License

MIT License - see [LICENSE](../../../../LICENSE) file for details.
