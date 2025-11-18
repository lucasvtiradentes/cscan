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

echo ""
echo "📦 Copying binaries to root binaries folder..."
cd ../..
mkdir -p binaries

for TARGET in "${TARGETS[@]}"; do
  if [[ "$TARGET" == *"windows"* ]]; then
    SERVER_PATH="packages/cscan-core/target/$TARGET/release/cscan-server.exe"
    CLI_PATH="packages/cscan-core/target/$TARGET/release/cscan.exe"

    if [ -f "$SERVER_PATH" ]; then
      cp "$SERVER_PATH" "binaries/cscan-server-$TARGET.exe"
      echo "✅ Copied cscan-server-$TARGET.exe"
    fi

    if [ -f "$CLI_PATH" ]; then
      cp "$CLI_PATH" "binaries/cscan-$TARGET.exe"
      echo "✅ Copied cscan-$TARGET.exe"
    fi
  else
    SERVER_PATH="packages/cscan-core/target/$TARGET/release/cscan-server"
    CLI_PATH="packages/cscan-core/target/$TARGET/release/cscan"

    if [ -f "$SERVER_PATH" ]; then
      cp "$SERVER_PATH" "binaries/cscan-server-$TARGET"
      echo "✅ Copied cscan-server-$TARGET"
    fi

    if [ -f "$CLI_PATH" ]; then
      cp "$CLI_PATH" "binaries/cscan-$TARGET"
      echo "✅ Copied cscan-$TARGET"
    fi
  fi
done

echo ""
echo "🎉 All done! Binaries in binaries/"
ls -lh binaries/ 2>/dev/null || true
