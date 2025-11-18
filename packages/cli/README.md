<a name="TOC"></a>

<div align="center">
<h4>cscan</h4>
<p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <br>
  <a href="#-overview">Overview</a> • <a href="#-installation">Installation</a> • <a href="#-usage">Usage</a> • <a href="#-architecture">Architecture</a> • <a href="#-development">Development</a>
</p>

</div>

<a href="#"><img src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/divider.png" /></a>

## 🎺 Overview

Standalone command-line interface for cscan, the high-performance TypeScript/TSX code quality scanner powered by Rust.

<a name="TOC"></a>

## 📦 Installation<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

### Global Installation

```bash
npm install -g cscan
pnpm add -g cscan
yarn global add cscan
```

### npx (No Installation)

```bash
npx cscan check
npx cscan rules
```

### Supported Platforms

Pre-built binaries available for:
- **Linux**: x64, ARM64
- **macOS**: Intel (x64), Apple Silicon (ARM64)
- **Windows**: x64

## 💡 Usage<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

### Initialize Configuration

Create default `.cscan/rules.json`:

```bash
cscan init
cscan init /path/to/project
```

### Check Code Quality

Scan files and report issues:

```bash
cscan check
cscan check /path/to/project
cscan check --no-cache
```

**Exit codes:**
- `0` - No errors (warnings allowed)
- `1` - Errors found or configuration missing

### List Rules

Display configured rules:

```bash
cscan rules
cscan rules /path/to/project
```

### Example Output

**Check Command:**
```
Scanning...

src/index.ts
  ✖ 5:10 Found ': any' type annotation [no-any-type]
    const x: any = 5;
  ⚠ 10:7 'count' is never reassigned, use 'const' instead [prefer-const]
    let count = 0;

✖ 2 errors, 1 warnings
Scanned 2 files in 45ms
```

**Rules Command:**
```
cscan Rules Configuration
Config: /home/user/project/.cscan/rules.json

23 enabled rules:

  • no-any-type [AST] ERROR
  • prefer-const [AST] WARN
    Variables never reassigned should use 'const'
  • no-console-log [REGEX] ERROR
    Pattern: console\.log\(

5 disabled rules
```

## 🏗️ Architecture<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

### Multi-Package Distribution

This package uses a multi-package architecture for distributing pre-compiled binaries:

**Main Package:**
- `cscan` - Wrapper scripts and platform detection

**Platform Packages (optional dependencies):**
- `@cscan/linux-x64` - Linux x64 binary
- `@cscan/linux-arm64` - Linux ARM64 binary
- `@cscan/darwin-x64` - macOS Intel binary
- `@cscan/darwin-arm64` - macOS Apple Silicon binary
- `@cscan/win32-x64` - Windows x64 binary

npm automatically installs only the binary for your platform.

### Source Structure

```
packages/cli/
├── src/
│   ├── cscan.ts             # Main wrapper script
│   └── postinstall.ts       # Installation validation
├── dist/                    # Compiled JavaScript (TypeScript output)
│   ├── cscan.js
│   ├── cscan.d.ts
│   ├── postinstall.js
│   └── postinstall.d.ts
├── npm/                     # Platform binaries (copied by build)
│   ├── linux-x64/
│   │   ├── package.json
│   │   └── cscan
│   ├── linux-arm64/
│   ├── darwin-x64/
│   ├── darwin-arm64/
│   └── win32-x64/
│       └── cscan.exe
├── scripts/
│   └── copy-binaries.sh     # Copies Rust binaries to npm/
├── package.json
├── tsconfig.json
└── biome.json
```

### How It Works

1. User installs `cscan`
2. npm installs appropriate platform package via `optionalDependencies`
3. `dist/cscan.js` detects platform and spawns correct binary
4. Binary executes with args passed through

## 🔧 Development<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

### Build Commands

```bash
pnpm install                 # Install dependencies
pnpm typecheck               # TypeScript type checking
pnpm lint                    # Lint with Biome
pnpm format                  # Format code with Biome
pnpm run build               # Compile TS + copy Rust binaries
pnpm run dev                 # Watch mode for TypeScript
```

### Development Workflow

**1. Build Rust binaries:**
```bash
cd ../cscan-core
cargo build --release --bin cscan
```

Or build for all platforms:
```bash
cd ../..
pnpm run build:rust:all
```

**2. Compile TypeScript + copy binaries:**
```bash
cd packages/cli
pnpm run build
```

**3. Test locally:**
```bash
npm link
cscan --version
cscan check
```

### Configuration Resolution

cscan searches for configuration in this priority order:

1. **Local Project Config** (recommended)
   - `.cscan/rules.json` in project root
   - User-managed, version-controlled

2. **VSCode Global Config** (compatibility mode)
   - `~/.vscode/extensions/.cscan-config-{hash}.json`
   - Auto-managed by VSCode extension
   - Hash based on workspace path (MD5)

If no configuration is found, cscan exits with helpful error message.

### Configuration File

`.cscan/rules.json` format:

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

## 📦 Publishing with Changesets<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

This monorepo uses `@changesets/cli` for version management.

### Publishing Workflow

**1. Create changeset:**
```bash
pnpm changeset
```

Select packages to version:
- `cscan` (main package)
- Platform packages (all 5)

**2. Build Rust binaries (all platforms):**
```bash
cd packages/cscan-core
./scripts/build-binaries.sh
```

**3. Copy binaries to npm packages:**
```bash
cd ../cli
pnpm run build
```

**4. Version packages:**
```bash
pnpm changeset version
```

**5. Publish to npm:**
```bash
pnpm changeset publish
```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build Rust binaries
        run: pnpm run build:rust:all

      - name: Build TypeScript + copy binaries
        run: |
          cd packages/cli
          pnpm run build

      - name: Publish packages
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 🚀 Use Cases<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

### CI/CD Pipeline

```bash
#!/bin/bash
set -e

cscan check || {
  echo "Code quality issues found"
  exit 1
}

echo "✅ Code quality checks passed"
```

### Pre-commit Hook

```bash
#!/bin/sh

if ! command -v cscan &> /dev/null; then
  echo "cscan not installed, skipping"
  exit 0
fi

if [ ! -f .cscan/rules.json ]; then
  echo "No cscan config, skipping"
  exit 0
fi

cscan check --no-cache
```

### VS Code Task

`.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "cscan: Check",
      "type": "shell",
      "command": "cscan check",
      "problemMatcher": []
    }
  ]
}
```

## 📊 Performance<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

**Caching:**
- File-level cache: `~/.cache/cscan/cache_{config_hash}.json`
- Invalidated on file change or config update
- Use `--no-cache` to bypass

**Parallel Processing:**
- Rayon-powered multi-core file analysis
- Scales with available CPU cores
- Typical: 100-500 files in <1s

## 🔍 Comparison<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

| Feature | CLI | VSCode Extension |
|---------|-----|------------------|
| Config Source | Project or VSCode global | Project or VSCode global |
| Git Integration | ❌ No branch mode | ✅ Branch-based scanning |
| File Watching | ❌ Manual scan only | ✅ Auto re-scan on change |
| UI | Terminal output | Tree/List view sidebar |
| Navigation | ❌ No jump-to-issue | ✅ Click to navigate |
| Use Case | CI/CD, pre-commit | Interactive development |

## 📜 License<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscan/main/.github/image/up_arrow.png" width="22"></a>

MIT License - see [LICENSE](../../LICENSE) file for details.
