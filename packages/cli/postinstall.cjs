#!/usr/bin/env node

const { chmodSync } = require('fs');
const { join } = require('path');

const PLATFORM_MAP = {
  'linux-x64': '@tscanner/cli-linux-x64',
  'linux-arm64': '@tscanner/cli-linux-arm64',
  'darwin-x64': '@tscanner/cli-darwin-x64',
  'darwin-arm64': '@tscanner/cli-darwin-arm64',
  'win32-x64': '@tscanner/cli-win32-x64',
};

function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'linux') {
    if (arch === 'x64') return 'linux-x64';
    if (arch === 'arm64') return 'linux-arm64';
  }

  if (platform === 'darwin') {
    if (arch === 'x64') return 'darwin-x64';
    if (arch === 'arm64') return 'darwin-arm64';
  }

  if (platform === 'win32') {
    if (arch === 'x64') return 'win32-x64';
  }

  return null;
}

const platformKey = getPlatformKey();
const isWorkspace = process.env.PNPM_SCRIPT_SRC_DIR !== undefined;

if (!platformKey) {
  if (!isWorkspace) {
    console.warn(
      `\nWarning: tscanner does not have a prebuilt binary for ${process.platform}-${process.arch}\n` +
        `Supported platforms:\n` +
        `  - Linux (x64, arm64)\n` +
        `  - macOS (x64, arm64)\n` +
        `  - Windows (x64)\n`,
    );
  }
  process.exit(0);
}

const packageName = PLATFORM_MAP[platformKey];

try {
  const packagePath = require.resolve(packageName);
  const binaryName = process.platform === 'win32' ? 'tscanner.exe' : 'tscanner';
  const binaryPath = join(packagePath, '..', binaryName);

  if (process.platform !== 'win32') {
    try {
      chmodSync(binaryPath, 0o755);
    } catch (e) {
      // Ignore chmod errors in case file doesn't exist or already has correct permissions
    }
  }

  if (!isWorkspace) {
    console.log(`✅ tscanner binary installed successfully (${platformKey})`);
  }
} catch (e) {
  if (!isWorkspace) {
    console.warn(
      `\nWarning: Failed to install tscanner binary for ${platformKey}\n` +
        `Expected package: ${packageName}\n` +
        `This might happen if optional dependencies were not installed.\n`,
    );
  }
}
