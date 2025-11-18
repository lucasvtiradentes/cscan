#!/bin/bash
set -e

echo "🚀 Starting release process..."
echo "============================================"

# Step 1: Publish npm packages via changesets
echo ""
echo "📦 Publishing npm packages..."
pnpm changeset publish

echo ""
echo "✅ npm packages published!"

# Step 2: Handle VSCode extension
VSCODE_PKG="packages/vscode-extension/package.json"
echo ""
echo "🔍 Checking VS Code extension state..."
echo "📄 Package: $VSCODE_PKG"

if [ ! -f "$VSCODE_PKG" ]; then
  echo "❌ ERROR: Package.json not found at $VSCODE_PKG"
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./$VSCODE_PKG').version")
echo "📌 Current version: $CURRENT_VERSION"

PREVIOUS_VERSION=""
if git rev-parse HEAD^ >/dev/null 2>&1; then
  PREVIOUS_VERSION=$(git show HEAD^:./$VSCODE_PKG 2>/dev/null | node -p "try { JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8')).version } catch(e) { '' }" || echo "")
  if [ -n "$PREVIOUS_VERSION" ]; then
    echo "📌 Previous version: $PREVIOUS_VERSION"
  else
    echo "⚠️  Could not read previous version from git"
  fi
else
  echo "⚠️  No previous commit available (shallow clone or first commit)"
fi

echo ""
echo "🔄 Determining if VS Code extension should be published..."

SHOULD_PUBLISH=false

if [ -n "$PREVIOUS_VERSION" ] && [ "$PREVIOUS_VERSION" != "$CURRENT_VERSION" ]; then
  echo "✅ Version bumped in this commit: $PREVIOUS_VERSION → $CURRENT_VERSION"
  SHOULD_PUBLISH=true
else
  echo "ℹ️  Version not changed in this commit"
fi

if [ "$SHOULD_PUBLISH" = true ]; then
  echo "✅ Publishing to VS Code Marketplace..."

  if ! command -v vsce &> /dev/null; then
    echo "📥 Installing vsce..."
    npm install -g @vscode/vsce
  fi

  echo ""
  echo "🏗️  Building VS Code extension..."
  cd packages/vscode-extension
  pnpm build

  echo ""
  echo "📦 Packaging extension..."
  vsce package --no-dependencies

  echo ""
  echo "📤 Publishing to Marketplace..."

  if [ -n "$AZURE_VSCODE_PAT" ]; then
    echo "🔑 Using AZURE_VSCODE_PAT from environment"
    vsce publish --no-dependencies --pat "$AZURE_VSCODE_PAT"
  else
    echo "🔑 Using PAT from vsce login"
    vsce publish --no-dependencies
  fi

  cd ../..

  echo ""
  echo "✅ VS Code extension v$CURRENT_VERSION published to Marketplace!"
else
  echo "⚠️  Skipping Marketplace publish"

  echo ""
  echo "🐛 Debug info:"
  echo "   - Current version: $CURRENT_VERSION"
  echo "   - Previous version: ${PREVIOUS_VERSION:-unknown}"
  echo "   - Package private: $(node -p "require('./$VSCODE_PKG').private || false")"
  echo "   - Recent git tags:"
  git tag --list "v*" | tail -3 || echo "     (none)"
fi

echo ""
echo "🎉 Release process completed!"
echo "============================================"
