<a name="TOC"></a>

<div align="center">
<img width="128" src="packages/vscode-extension/resources/icon.svg" alt="Lino logo">
<h4>Lino</h4>
<p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <br>
  <a href="#-overview">Overview</a> • <a href="#-features">Features</a> • <a href="#-architecture">Architecture</a> • <a href="#-quick-start">Quick Start</a> • <a href="#-development">Development</a>
</p>

</div>

<a href="#"><img src="./.github/image/divider.png" /></a>

## 🎺 Overview

High-performance TypeScript linting platform designed for instant LLM code quality validation. Branch-based scanning shows exactly which issues were introduced in your current work, while fully customizable rules let you enforce your project's specific conventions - whether you prefer types over interfaces, ban barrel files, or require absolute imports.

<a name="TOC"></a>

## ❓ Motivation<a href="#TOC"><img align="right" src="./.github/image/up_arrow.png" width="22"></a>

**Instant LLM Code Quality Feedback**

When working with LLMs (Claude, GPT, etc.), you need to spot code quality issues immediately - before they accumulate. Lino provides instant, per-branch visibility into how good/bad the LLM-generated code is, saving you time by knowing exactly where to ask for corrections.

**Project-Specific Conventions**

Every codebase has its own rules: some prefer `type` over `interface`, others ban barrel files, some require absolute imports. Lino lets you define these conventions in `.lino/rules.json` and enforce them automatically - whether the code is written by you, your team, or an LLM.

**Performance Without Compromise**

Traditional TypeScript linters sacrifice speed for extensibility or vice versa. Lino bridges this gap by leveraging Rust's speed for core analysis (SWC-based AST parsing with Rayon parallelism) while providing a TypeScript interface for VSCode integration and custom regex rules.

## ⭐ Features<a href="#TOC"><img align="right" src="./.github/image/up_arrow.png" width="22"></a>

**Core Linting**
- **23 Built-in Rules** - Comprehensive coverage across type safety, code quality, variables, imports, and bug prevention
- **Project-Specific Rules** - Define your conventions: `prefer-type-over-interface`, `no-barrel-files`, `no-relative-imports`, etc.
- **Custom Regex Rules** - Create rules for your unique patterns (naming conventions, comment markers, etc.)
- **AST-based Analysis** - SWC-powered TypeScript/TSX parsing for accurate detection
- **Configurable Severity** - Error or warning levels per rule - adapt to your project's strictness
- **Disable Directives** - Inline comments to disable rules (`lino-disable`, `lino-disable-next-line`) when needed

**VSCode Integration**
- **Tree/List Views** - Hierarchical folder structure or flat file listing
- **Group by Rule** - Organize issues by rule type or file
- **Sidebar Integration** - Activity bar icon with live issue count badge
- **Click to Navigate** - Jump directly to any issue in your code
- **Keyboard Navigation** - F8/Shift+F8 to cycle through issues
- **Context Actions** - Copy file paths (absolute/relative) from tree items
- **Status Bar** - Shows current scan mode and branch

**Git Integration (LLM Code Review)**
- **Branch Mode** - Scan only changed files vs target branch (git diff) - perfect for reviewing LLM-generated code
- **Line-level Filtering** - Show only issues in modified lines - see exactly what the LLM introduced
- **Workspace Mode** - Full codebase scan for comprehensive analysis
- **Live Updates** - Incremental re-scan on file changes - instant feedback as you work with LLMs

**Performance**
- **Parallel Processing** - Rayon-powered concurrent file analysis
- **Smart Caching** - File + config hash-based cache with disk persistence
- **GZIP Compression** - Compressed JSON-RPC responses for large datasets (80%+ reduction)
- **Inventory-based Rule Registry** - Compile-time rule registration

## 📦 Architecture<a href="#TOC"><img align="right" src="./.github/image/up_arrow.png" width="22"></a>

Hybrid Rust + TypeScript architecture with JSON-RPC communication:

```
VSCode Extension (TypeScript)         lino-server (Rust)
├─ extension.ts              ←→      ├─ JSON-RPC Interface
│  └─ Extension activation            │  └─ Line-delimited protocol
├─ commands/                          │     └─ GZIP compression
│  ├─ find-issue.ts                   ├─ Scanner (lino_core)
│  ├─ manage-rules.ts                 │  ├─ Rayon parallel processing
│  └─ settings.ts                     │  ├─ File discovery (ignore crate)
├─ sidebar/                           │  └─ Incremental updates
│  ├─ search-provider.ts              ├─ Parser (SWC)
│  └─ tree-builder.ts                 │  ├─ TypeScript/TSX support
├─ common/lib/                        │  └─ AST traversal
│  ├─ rust-client.ts                  ├─ Rule Registry (23 rules)
│  ├─ scanner.ts                      │  ├─ Inventory auto-registration
│  └─ config-manager.ts               │  ├─ AST rules (visitor pattern)
├─ common/utils/                      │  └─ Regex rules
│  ├─ git-helper.ts                   ├─ File Cache (DashMap)
│  └─ logger.ts                       │  ├─ Memory cache (concurrent)
└─ status-bar/                        │  └─ Disk cache (JSON)
   └─ status-bar-manager.ts           └─ Config System
                                         ├─ .lino/rules.json
                                         └─ Hash-based invalidation
```

## 🚀 Quick Start<a href="#TOC"><img align="right" src="./.github/image/up_arrow.png" width="22"></a>

### Prerequisites

- **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **pnpm**: `npm install -g pnpm`
- **VSCode**: v1.100.0+

### Installation

```bash
git clone https://github.com/lucasvtiradentes/lino
cd lino
./scripts/setup-dev.sh
```

### VSCode Extension Development

```bash
pnpm dev
```

Then press `F5` in VSCode to launch Extension Development Host.

### Standalone Rust Development

```bash
cd packages/lino-core
cargo watch -x build
```

## 📦 Package Structure<a href="#TOC"><img align="right" src="./.github/image/up_arrow.png" width="22"></a>

### lino-core (Rust)

Rust workspace with three crates:

- **`lino_core`** - Core library (Scanner, Parser, Rules, Cache, Config)
- **`lino_server`** - JSON-RPC server binary (main entry point for VSCode)
- **`lino_cli`** - CLI binary (planned, currently stub)

[Detailed Documentation →](packages/lino-core/README.md)

### vscode-extension (TypeScript)

VSCode extension for editor integration with real-time feedback.

[Detailed Documentation →](packages/vscode-extension/README.md)

## 🔧 Development<a href="#TOC"><img align="right" src="./.github/image/up_arrow.png" width="22"></a>

### Build Commands

```bash
pnpm dev                        # Watch mode: Extension + Rust auto-rebuild
pnpm run build                  # Build extension (bundles Rust binary)
./scripts/build-all.sh          # Build Rust workspace + extension
./scripts/build-binaries.sh     # Cross-compile for all platforms
./scripts/clean-install.sh      # Clean reinstall (clears cache)
```

### Development Workflow

**Terminal 1 - Rust auto-rebuild:**
```bash
cd packages/lino-core
cargo watch -x build
```

**Terminal 2 - Extension auto-rebuild:**
```bash
pnpm dev
```

**VSCode - Debug Extension:**
Press `F5` to launch Extension Development Host

### Cross-Platform Binaries

```bash
./scripts/build-binaries.sh
```

Targets:
- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `x86_64-apple-darwin`
- `aarch64-apple-darwin`
- `x86_64-pc-windows-msvc`

### Configuration File

Create `.lino/rules.json` to enforce your project's conventions:

```json
{
  "rules": {
    "no-any-type": {
      "enabled": true,
      "type": "ast",
      "severity": "error"
    },
    "prefer-type-over-interface": {
      "enabled": true,
      "type": "ast",
      "severity": "warning",
      "message": "This project uses type aliases, not interfaces"
    },
    "no-relative-imports": {
      "enabled": true,
      "type": "ast",
      "severity": "error",
      "message": "Use absolute imports with @ alias"
    },
    "custom-todo-pattern": {
      "enabled": true,
      "type": "regex",
      "severity": "warning",
      "pattern": "TODO:|FIXME:",
      "message": "Clean up LLM-generated TODOs before committing"
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["**/node_modules/**", "**/dist/**"]
}
```

**Example: Catching LLM Issues**
```typescript
// LLM often generates:
const data: any = fetchData();        // ❌ Caught by no-any-type
export interface Config { ... }      // ⚠️  Caught by prefer-type-over-interface
import { utils } from "../utils";    // ❌ Caught by no-relative-imports
// TODO: implement error handling    // ⚠️  Caught by custom-todo-pattern
```

## 📜 License<a href="#TOC"><img align="right" src="./.github/image/up_arrow.png" width="22"></a>

MIT License - see [LICENSE](LICENSE) file for details.
