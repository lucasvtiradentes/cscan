<a name="TOC"></a>

<div align="center">
<img width="128" src="https://raw.githubusercontent.com/lucasvtiradentes/cscanner/main/packages/vscode-extension/resources/icon.png" alt="cscanner Extension logo">
<h4>cscanner - VS Code Extension</h4>
<p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <br>
  <a href="#-overview">Overview</a> • <a href="#-features">Features</a> • <a href="#-usage">Usage</a> • <a href="#-architecture">Architecture</a> • <a href="#-development">Development</a>
</p>

</div>

<a href="#"><img src="https://raw.githubusercontent.com/lucasvtiradentes/cscanner/main/.github/image/divider.png" /></a>

## 🎺 Overview

VSCode extension for validating code patterns, detecting anti-patterns, and enforcing project conventions in TypeScript/TSX. Provides real-time feedback with tree/list views, Git-based incremental scanning, and customizable rule management for architectural validation.

<a name="TOC"></a>

## ⭐ Features<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscanner/main/.github/image/up_arrow.png" width="22"></a>

**View Modes**
- **Tree View** - Hierarchical folder structure with expandable nodes
- **List View** - Flat file listing for quick navigation
- **Group by Rule** - Organize issues by rule type instead of file
- **Badge Count** - Activity bar shows total issue count

**Scan Modes**
- **Workspace Mode** - Scan all TypeScript/TSX files in workspace
- **Branch Mode** - Scan only changed files vs target branch (git diff)
  - Line-level filtering: Show only issues in modified lines
  - Auto-refresh on file changes
  - Configurable target branch (main, develop, etc.)

**Navigation**
- **Click to Jump** - Click any issue to open file at exact location
- **Keyboard Navigation** - F8/Shift+F8 to cycle through issues
- **Context Menus** - Copy file paths (absolute/relative)
- **Status Bar** - Shows current scan mode and target branch

**Pattern & Convention Management**
- **Interactive UI** - Multi-select categorized rule picker
- **23 Built-in Rules** - Pattern validators and anti-pattern detectors across 6 categories
- **Custom Regex Patterns** - Define project-specific validation patterns
- **Convention Enforcement** - Import styles, naming patterns, architectural rules
- **Global vs Local Config** - Workspace-specific or global defaults
- **Live Validation** - Config errors shown immediately

**Performance**
- **Incremental Updates** - File watcher re-scans only changed files
- **Smart Caching** - Rust backend caches parsed ASTs
- **Parallel Processing** - Multi-core file analysis
- **GZIP Compression** - 80%+ response size reduction

## 💡 Usage<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscanner/main/.github/image/up_arrow.png" width="22"></a>

### Getting Started

1. Open a TypeScript/TSX workspace in VSCode
2. Click the cscanner icon in activity bar
3. Configure rules via settings menu
4. View issues in sidebar tree

### Commands

**Command Palette (Ctrl/Cmd + Shift + P):**
- `cscanner: Scan Workspace` - Run full scan
- `cscanner: Hard Scan` - Clear cache and rescan
- `cscanner: Open Settings` - Configure scan mode and rules
- `cscanner: Go to Next Issue` (F8) - Navigate to next issue
- `cscanner: Go to Previous Issue` (Shift+F8) - Navigate to previous issue
- `cscanner: Show Logs` - Open extension log file

**Sidebar Toolbar:**
- **Refresh** - Re-scan workspace
- **Group by Rule** - Toggle grouping mode
- **View as Tree/List** - Toggle view mode

### Settings Menu

Access via status bar click or `cscanner: Open Settings` command:

**1. Manage Rules**
- Multi-select interface with categorized rules
- Enable/disable built-in rules
- Add custom regex rules
- Save to global or local config

**2. Manage Scan Settings**
- **Codebase** - Scan all files in workspace
- **Branch** - Scan only changed files vs selected branch
  - Choose current branch
  - Select from local/remote branches

**3. Open Project cscanner Configs**
- Open local `.cscanner/rules.json`
- Open global config file
- Create config from template

### View Modes

**List View + Default Grouping:**
```
📄 src/index.ts (2 issues)
  ├─ Line 5: Found ': any' type annotation
  └─ Line 10: Prefer 'const' over 'let'
📄 src/utils.ts (1 issue)
  └─ Line 3: console.log() statement
```

**Tree View + Default Grouping:**
```
📁 src
  ├─ 📄 index.ts (2 issues)
  │   ├─ Line 5: Found ': any' type annotation
  │   └─ Line 10: Prefer 'const' over 'let'
  └─ 📄 utils.ts (1 issue)
      └─ Line 3: console.log() statement
```

**List View + Group by Rule:**
```
no-any-type (2 issues)
  ├─ 📄 src/index.ts:5 - Found ': any' type annotation
  └─ 📄 src/utils.ts:10 - Found 'as any' type assertion
prefer-const (1 issue)
  └─ 📄 src/index.ts:10 - 'x' is never reassigned
```

**Tree View + Group by Rule:**
```
no-any-type (2 issues)
  └─ 📁 src
      ├─ 📄 index.ts
      │   └─ Line 5: Found ': any' type annotation
      └─ 📄 utils.ts
          └─ Line 10: Found 'as any' type assertion
```

### Scan Modes

**Workspace Mode:**
- Scans all `.ts`/`.tsx` files in workspace
- Respects `.cscanner/rules.json` include/exclude patterns
- Ideal for full codebase analysis

**Branch Mode:**
- Runs `git diff` vs target branch to get changed files
- Parses diff hunks to extract modified line ranges
- Scans all files but filters issues to modified lines only
- Ideal for PR review workflow and LLM code validation

**Example: Branch Mode**
```bash
# Behind the scenes:
git diff main --name-only          # Get changed files
git diff main -- src/index.ts      # Get line ranges

# VSCode extension then:
1. Scans all changed files
2. Filters issues to modified lines only
3. Updates tree view with filtered results
```

### Configuration File

Create `.cscanner/rules.json` in workspace root:

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
    "custom-todo": {
      "enabled": true,
      "type": "regex",
      "severity": "warning",
      "pattern": "TODO:",
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

**Config Locations:**
- **Local:** `.cscanner/rules.json` in workspace root (takes precedence)
- **Global:** `~/.vscode/extensions/.cscanner-config-{workspace-hash}.json`

### Disable Directives

Inline comments to disable rules:

```typescript
// cscanner-disable-file
// Disables all rules for entire file

// cscanner-disable rule1, rule2
const x: any = 5;  // This line is ignored

// cscanner-disable-line rule1
const y: any = 5;  // This line is ignored

// cscanner-disable-next-line rule1
const z: any = 5;  // Next line is ignored
```

## 🏗️ Architecture<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscanner/main/.github/image/up_arrow.png" width="22"></a>

### Source Structure

```
src/
├── extension.ts                          # Extension entry point
├── commands/
│   ├── index.ts                          # Command registration
│   ├── find-issue.ts                     # Main scan logic
│   ├── scan.ts                           # Refresh & hard scan
│   ├── view-mode.ts                      # List/tree/group toggles
│   ├── navigation.ts                     # File opening & path copying
│   ├── manage-rules.ts                   # Rule configuration UI
│   ├── settings.ts                       # Settings menu
│   ├── issue-navigation.ts               # F8/Shift+F8 navigation
│   └── show-logs.ts                      # Open log file
├── sidebar/
│   ├── search-provider.ts                # TreeDataProvider implementation
│   ├── tree-builder.ts                   # Build folder hierarchy
│   └── tree-items.ts                     # Tree item classes
├── common/
│   ├── types.ts                          # TypeScript interfaces
│   ├── lib/
│   │   ├── scanner.ts                    # Rust client orchestrator
│   │   ├── rust-client.ts                # JSON-RPC client
│   │   └── config-manager.ts             # Config loading/saving
│   └── utils/
│       ├── logger.ts                     # File-based logging
│       ├── git-helper.ts                 # Git integration
│       └── issue-comparator.ts           # Filter issues by modified lines
└── status-bar/
    └── status-bar-manager.ts             # Status bar display
```

### Extension Lifecycle

**Activation (onStartupFinished):**
```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. Prevent duplicate activation
  if (activationKey === currentWorkspace) return;

  // 2. Restore workspace state
  const viewMode = context.workspaceState.get('cscanner.viewMode', 'list');
  const groupMode = context.workspaceState.get('cscanner.groupMode', 'default');
  const scanMode = context.workspaceState.get('cscanner.scanMode', 'workspace');
  const cachedResults = context.workspaceState.get('cscanner.cachedResults', []);

  // 3. Initialize providers
  const searchProvider = new SearchResultProvider();
  searchProvider.setResults(deserializedResults);

  const treeView = vscode.window.createTreeView('cscanExplorer', {
    treeDataProvider: searchProvider,
  });

  // 4. Register commands
  registerAllCommands({ searchProvider, context, treeView, ... });

  // 5. Setup file watcher
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');
  fileWatcher.onDidChange(updateSingleFile);
  fileWatcher.onDidCreate(updateSingleFile);
  fileWatcher.onDidDelete(removeSingleFile);

  // 6. Initial scan after 2s
  setTimeout(() => {
    vscode.commands.executeCommand('cscanner.findIssue');
  }, 2000);
}
```

**Deactivation:**
```typescript
export function deactivate() {
  dispose(scannerInstance);  // Stop Rust server
}
```

### JSON-RPC Client

**RustClient Class:**
```typescript
export class RustClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve, reject }>();
  private buffer = '';

  async start(): Promise<void> {
    this.process = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { RUST_LOG: 'core=warn,cscanner_server=info' }
    });

    // Handle stdout (JSON-RPC responses)
    this.process.stdout.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('GZIP:')) {
          // Decompress GZIP + Base64
          const compressed = Buffer.from(line.substring(5), 'base64');
          const decompressed = zlib.gunzipSync(compressed);
          jsonString = decompressed.toString('utf8');
        }

        const response: RpcResponse = JSON.parse(jsonString);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          pending.resolve(response.result);
        }
      }
    });
  }

  async scan(root: string, fileFilter?: Set<string>, config?: any): Promise<IssueResult[]> {
    const result: ScanResult = await this.sendRequest('scan', { root, config });

    // Post-process: filter files, add line text
    return result.files.flatMap(file =>
      file.issues.map(issue => ({
        uri: vscode.Uri.file(file.file),
        rule: issue.rule,
        line: issue.line,
        column: issue.column,
        message: issue.message,
        severity: issue.severity,
        lineText: issue.line_text || ''
      }))
    );
  }
}
```

### Git Integration

**Changed Files Detection:**
```typescript
export async function getChangedFiles(
  workspaceRoot: string,
  compareBranch: string
): Promise<Set<string>> {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  const git = gitExtension?.exports.getAPI(1);
  const repo = git?.repositories[0];

  // Get uncommitted changes
  const uncommittedFiles = repo.state.workingTreeChanges
    .concat(repo.state.indexChanges)
    .map(change => change.uri.fsPath);

  // Get committed changes vs branch
  const committedFiles = await getCommittedChanges(workspaceRoot, compareBranch);

  return new Set([...uncommittedFiles, ...committedFiles]);
}

async function getCommittedChanges(
  workspaceRoot: string,
  compareBranch: string
): Promise<string[]> {
  const { stdout } = await execAsync(
    `git diff ${compareBranch}...HEAD --name-only`,
    { cwd: workspaceRoot }
  );

  return stdout
    .split('\n')
    .filter(line => line.trim())
    .map(file => path.join(workspaceRoot, file));
}
```

**Modified Line Ranges:**
```typescript
export async function getModifiedLineRanges(
  workspaceRoot: string,
  filePath: string,
  compareBranch: string
): Promise<ModifiedLineRange[]> {
  const { stdout } = await execAsync(
    `git diff ${compareBranch}...HEAD -- ${filePath}`,
    { cwd: workspaceRoot }
  );

  const ranges: ModifiedLineRange[] = [];
  const hunkRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;

  let match;
  while ((match = hunkRegex.exec(stdout)) !== null) {
    const startLine = parseInt(match[1], 10);
    const lineCount = match[2] ? parseInt(match[2], 10) : 1;
    const endLine = startLine + lineCount - 1;

    ranges.push({ startLine, endLine });
  }

  return ranges;
}
```

## 🔧 Development<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscanner/main/.github/image/up_arrow.png" width="22"></a>

### Build Commands

```bash
pnpm install                     # Install dependencies
pnpm run compile                 # TypeScript compilation
pnpm run bundle                  # esbuild minified bundle
pnpm run build                   # Bundle + install locally
pnpm run dev                     # Watch mode for development
```

### Local Installation

```bash
pnpm run build
```

This bundles the extension and copies it to `~/.vscode/extensions/cscanner-vscode/`.

**Extension locations:**
- Development: `~/.vscode/extensions/cscanner-vscode/`
- Production: Install from `.vsix` package

### Development Workflow

**Terminal 1 - Rust auto-rebuild:**
```bash
cd ../../packages/core
cargo watch -x build
```

**Terminal 2 - Extension watch mode:**
```bash
pnpm run dev
```

**VSCode - Debug Extension:**
1. Open `packages/vscode-extension` in VSCode
2. Press `F5` to launch Extension Development Host
3. Open a TypeScript workspace in new window
4. Click cscanner icon in activity bar

### Package Scripts

```json
{
  "compile": "tsc -p ./",
  "bundle": "npm run script:setup-rust-binary && npm run bundle:ci",
  "bundle:ci": "esbuild ./src/extension.ts --bundle --outfile=out/extension.js --external:vscode --format=cjs --platform=node --minify",
  "build": "pnpm run bundle",
  "postbuild": "npm run script:install-locally",
  "postinstall": "npm run script:setup-rust-binary",
  "script:setup-rust-binary": "tsx extension-scripts/setup-rust-binary.ts",
  "script:install-locally": "tsx extension-scripts/install-local.ts"
}
```

### Setup Rust Binary

The `setup-rust-binary.ts` script:
1. Detects platform (linux-x64, darwin-arm64, etc.)
2. Downloads pre-built binary from GitHub releases
3. Fallback to local build if download fails
4. Sets executable permissions

**Platform Targets:**
- `linux-x64` → `x86_64-unknown-linux-gnu`
- `linux-arm64` → `aarch64-unknown-linux-gnu`
- `darwin-x64` → `x86_64-apple-darwin`
- `darwin-arm64` → `aarch64-apple-darwin`
- `win32-x64` → `x86_64-pc-windows-msvc`

### Dependencies

**Runtime:**
- `vscode` API (^1.100.0)

**DevDependencies:**
- `@types/node` (^22.0.0)
- `@types/vscode` (^1.100.0)
- `esbuild` (^0.24.0) - Fast bundling
- `tsx` (^4.20.6) - TypeScript execution
- `typescript` (^5.7.0)

### Context Keys

Extension sets VSCode context keys for conditional menu visibility:

```typescript
vscode.commands.executeCommand('setContext', 'cscanViewMode', 'list' | 'tree');
vscode.commands.executeCommand('setContext', 'cscanGroupMode', 'default' | 'rule');
vscode.commands.executeCommand('setContext', 'cscanScanMode', 'workspace' | 'branch');
vscode.commands.executeCommand('setContext', 'cscanSearching', true | false);
```

**Usage in package.json:**
```json
{
  "command": "cscanner.setTreeView",
  "when": "view == cscanExplorer && cscanViewMode == list",
  "group": "navigation@30"
}
```

### Tree Item Context Values

Tree items have `contextValue` for context menu filtering:

- `cscanNodeFolder` - Folder items
- `cscanNodeFile` - File items (copy path available)
- `cscanNodeIssue` - Issue items
- `cscanNodeRuleGroup` - Rule group items

### Logging

Extension logs to `$TMPDIR/cscanlogs.txt`:

```typescript
import { logger } from './common/utils/logger';

logger.info('Extension activated');
logger.debug(`Scanning file: ${filePath}`);
logger.error(`Failed to scan: ${error}`);
```

**Log levels:** INFO, DEBUG, WARN, ERROR
**Format:** `[2025-01-17T10:30:45.123-03:00] [INFO] Extension activated`

## 📜 License<a href="#TOC"><img align="right" src="https://raw.githubusercontent.com/lucasvtiradentes/cscanner/main/.github/image/up_arrow.png" width="22"></a>

MIT License - see [LICENSE](../../LICENSE) file for details.
