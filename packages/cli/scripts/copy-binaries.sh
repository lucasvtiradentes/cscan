#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"
CSCAN_CORE_DIR="$CLI_DIR/../cscan-core"

echo "📦 Copying Rust binary for current platform..."

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" = "Linux" ]; then
  if [ "$ARCH" = "x86_64" ]; then
    NPM_PLATFORM="linux-x64"
  elif [ "$ARCH" = "aarch64" ]; then
    NPM_PLATFORM="linux-arm64"
  fi
elif [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "x86_64" ]; then
    NPM_PLATFORM="darwin-x64"
  elif [ "$ARCH" = "arm64" ]; then
    NPM_PLATFORM="darwin-arm64"
  fi
elif [[ "$OS" == MINGW* ]] || [[ "$OS" == MSYS* ]]; then
  NPM_PLATFORM="win32-x64"
fi

if [ -z "$NPM_PLATFORM" ]; then
  echo "⚠️  Unsupported platform: $OS-$ARCH"
  echo "Skipping binary copy..."
  exit 0
fi

SOURCE_PATH="$CSCAN_CORE_DIR/target/release/cscan"
if [[ "$NPM_PLATFORM" == win32* ]]; then
  SOURCE_PATH="$SOURCE_PATH.exe"
fi

DEST_DIR="$CLI_DIR/npm/$NPM_PLATFORM"
DEST_PATH="$DEST_DIR/cscan"
if [[ "$NPM_PLATFORM" == win32* ]]; then
  DEST_PATH="$DEST_PATH.exe"
fi

if [ -f "$SOURCE_PATH" ]; then
  mkdir -p "$DEST_DIR"
  cp "$SOURCE_PATH" "$DEST_PATH"
  chmod +x "$DEST_PATH" 2>/dev/null || true
  echo "✅ Copied binary for $NPM_PLATFORM"
else
  echo "⚠️  Binary not found: $SOURCE_PATH"
  echo "Run 'cargo build --release --bin cscan' first!"
  exit 1
fi

echo ""
echo "✅ Binary copy complete!"
