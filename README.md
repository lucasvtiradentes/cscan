# Lino

VSCode extension to find and track TypeScript `any` type usage in your codebase.

## Features

- **Find any types**: Scans workspace for `: any` and `as any` patterns
- **Tree/List view**: Toggle between hierarchical folder view or flat list
- **Sidebar integration**: Dedicated activity bar icon with issue count badge
- **Click to navigate**: Jump directly to any type usage in your code
- **Context actions**: Copy file paths (absolute/relative) from tree items
- **Performance**: Parallel file processing with caching
- **Logging**: Debug logs at `$TMPDIR/linologs.txt`

## Usage

1. Click Lino icon in activity bar
2. Click search button to scan workspace
3. Toggle between tree/list view
4. Click any issue to jump to code location
5. Right-click files for copy path options

## Development

```bash
pnpm install
pnpm run build    # Bundle + auto-install to ~/.vscode/extensions
pnpm run watch    # Watch mode
```

Reload VSCode window after build to activate changes.

## Tech Stack

- TypeScript
- VSCode Extension API
- esbuild (bundler)
- pnpm (package manager)
