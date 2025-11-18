#!/bin/bash

set -e

echo "🔨 Building Rust binaries for all platforms..."

if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

cd packages/cscan-core

TARGETS=(
  "x86_64-unknown-linux-gnu"
  "aarch64-unknown-linux-gnu"
  "x86_64-apple-darwin"
  "aarch64-apple-darwin"
  "x86_64-pc-windows-msvc"
)

for TARGET in "${TARGETS[@]}"; do
  echo "Building for $TARGET..."

  if ! rustup target list --installed | grep -q "$TARGET"; then
    echo "Installing target $TARGET..."
    rustup target add "$TARGET"
  fi

  if [[ "$TARGET" == *"windows"* ]]; then
    cargo build --release --target "$TARGET" 2>/dev/null || echo "⚠️  Skipping $TARGET (requires cross-compilation tools)"
  elif [[ "$TARGET" == *"darwin"* ]] && [[ "$(uname)" != "Darwin" ]]; then
    cargo build --release --target "$TARGET" 2>/dev/null || echo "⚠️  Skipping $TARGET (requires macOS or cross-compilation tools)"
  elif [[ "$TARGET" == "aarch64-unknown-linux-gnu" ]] && [[ "$(uname -m)" != "aarch64" ]]; then
    cargo build --release --target "$TARGET" 2>/dev/null || echo "⚠️  Skipping $TARGET (requires cross-compilation tools)"
  else
    cargo build --release --target "$TARGET"
  fi
done

echo "✅ Binary builds completed!"
echo "📦 Binaries are in: packages/cscan-core/target/{target}/release/"
