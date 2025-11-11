# Lino Configuration

This directory contains Lino's configuration files.

## rules.json

Configure which rules to enable/disable and customize their behavior.

### Structure

```json
{
  "rules": {
    "rule-name": {
      "enabled": true,
      "type": "ast" | "regex",
      "severity": "error" | "warning",
      "message": "Custom error message",
      "include": ["glob patterns"],
      "exclude": ["glob patterns"],
      "pattern": "regex pattern (for regex rules)"
    }
  },
  "include": ["global include patterns"],
  "exclude": ["global exclude patterns"]
}
```

### Available Rules

#### no-any-type (AST)
Detects TypeScript `any` type usage (`: any` and `as any`).
- **Type**: AST-based
- **Default severity**: Error
- **Example**: `const x: any = 1` → ❌

#### no-console-log (Regex)
Finds `console.log()` statements in code.
- **Type**: Regex-based
- **Default severity**: Warning
- **Example**: `console.log('debug')` → ⚠️

#### no-relative-imports (AST)
Detects relative imports (starting with `./` or `../`).
- **Type**: AST-based
- **Default severity**: Warning
- **Example**: `import { foo } from './bar'` → ⚠️

#### prefer-type-over-interface (AST)
Suggests using `type` instead of `interface` for consistency.
- **Type**: AST-based
- **Default severity**: Warning
- **Example**: `interface User { }` → ⚠️ (prefer `type User = { }`)

### Configuration Examples

#### Enable all rules
```json
{
  "rules": {
    "no-any-type": { "enabled": true, "type": "ast", "severity": "error" },
    "no-console-log": { "enabled": true, "type": "regex", "severity": "warning" },
    "no-relative-imports": { "enabled": true, "type": "ast", "severity": "warning" },
    "prefer-type-over-interface": { "enabled": true, "type": "ast", "severity": "warning" }
  }
}
```

#### Only check for `any` types in source files
```json
{
  "rules": {
    "no-any-type": {
      "enabled": true,
      "type": "ast",
      "severity": "error",
      "include": ["src/**/*.ts"],
      "exclude": ["src/**/*.test.ts"]
    }
  }
}
```

#### Custom severity levels
```json
{
  "rules": {
    "no-console-log": {
      "enabled": true,
      "type": "regex",
      "severity": "error",
      "message": "Console.log is forbidden in production code"
    }
  }
}
```

### Glob Patterns

- `**/*.ts` - All TypeScript files
- `src/**/*.tsx` - All TSX files in src directory
- `!**/*.test.ts` - Exclude test files
- `{src,lib}/**/*.ts` - Multiple directories

### Per-Rule vs Global Patterns

- **Per-rule patterns**: Override global patterns for specific rules
- **Global patterns**: Apply to all rules unless overridden

```json
{
  "include": ["**/*.ts"],
  "exclude": ["**/*.test.ts"],
  "rules": {
    "no-any-type": {
      "enabled": true,
      "type": "ast",
      "severity": "error",
      "include": ["src/**/*.ts"]
    }
  }
}
```

In this example:
- Global: scan all `.ts` files except tests
- `no-any-type` rule: only scan `src/**/*.ts` files

### Default Configuration

If no `.lino/rules.json` exists, Lino uses this default:

```json
{
  "rules": {
    "no-any-type": {
      "enabled": true,
      "type": "ast",
      "severity": "error",
      "message": "Found 'any' type annotation"
    }
  },
  "include": ["**/*.{ts,tsx}"],
  "exclude": ["node_modules/**", "dist/**", "build/**", ".git/**"]
}
```

## Creating Custom Regex Rules

You can add custom regex-based rules directly in `rules.json`:

```json
{
  "rules": {
    "no-debugger": {
      "enabled": true,
      "type": "regex",
      "severity": "error",
      "pattern": "debugger;",
      "message": "Remove debugger statements before committing"
    },
    "no-todo-comments": {
      "enabled": true,
      "type": "regex",
      "severity": "warning",
      "pattern": "//\\s*TODO:",
      "message": "TODO comment found - create a ticket instead"
    },
    "no-fixme-comments": {
      "enabled": true,
      "type": "regex",
      "severity": "warning",
      "pattern": "//\\s*FIXME:",
      "message": "FIXME comment found - create a ticket instead"
    }
  }
}
```

**Note**: Regex rules are dynamically loaded from the configuration file. You don't need to modify Rust code to add them.

## Testing Configuration Changes

After modifying `.lino/rules.json`:

1. Reload VS Code window (Cmd/Ctrl + Shift + P → "Reload Window")
2. Run "Lino: Scan Workspace" command
3. Check the sidebar for updated results

The configuration is loaded on every scan, so changes take effect immediately after reloading.

## Troubleshooting

### Rule not working
- Check `enabled: true` in configuration
- Verify glob patterns match your files
- Ensure regex pattern is valid (test at regex101.com)
- Rebuild Rust backend: `cd packages/lino-core && cargo build --release`

### Too many false positives
- Add more specific glob patterns in `include`
- Add exclusions in `exclude`
- Change severity from `error` to `warning`

### Performance issues
- Use AST rules sparingly (they're slower than regex)
- Add aggressive exclude patterns for large directories
- Consider using branch mode instead of workspace mode
