# Changesets

This folder contains changeset files for tracking version bumps and releases.

## Usage

To create a new changeset:

```bash
pnpm changeset
```

Follow the prompts to:
1. Select which packages changed
2. Specify the version bump type (patch/minor/major)
3. Describe the changes

The changeset will be used to:
- Generate changelogs
- Bump package versions
- Publish to VS Code Marketplace (for vscode-extension)
