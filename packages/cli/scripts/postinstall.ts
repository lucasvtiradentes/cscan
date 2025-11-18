#!/usr/bin/env node

const PLATFORM_MAP: Record<string, string> = {
  'linux-x64': 'cscanner-linux-x64',
  'linux-arm64': 'cscanner-linux-arm64',
  'darwin-x64': 'cscanner-darwin-x64',
  'darwin-arm64': 'cscanner-darwin-arm64',
  'win32-x64': 'cscanner-win32-x64',
};

function getPlatformKey(): string | null {
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

if (!platformKey) {
  console.warn(
    `\nWarning: cscanner does not have a prebuilt binary for ${process.platform}-${process.arch}\n` +
      `Supported platforms:\n` +
      `  - Linux (x64, arm64)\n` +
      `  - macOS (x64, arm64)\n` +
      `  - Windows (x64)\n`,
  );
  process.exit(0);
}

const packageName = PLATFORM_MAP[platformKey];
const isWorkspace = process.env.PNPM_SCRIPT_SRC_DIR !== undefined;

try {
  require.resolve(packageName);
  if (!isWorkspace) {
    console.log(`✅ cscanner binary installed successfully (${platformKey})`);
  }
} catch (e) {
  if (!isWorkspace) {
    console.warn(
      `\nWarning: Failed to install cscanner binary for ${platformKey}\n` +
        `Expected package: ${packageName}\n` +
        `This might happen if optional dependencies were not installed.\n`,
    );
  }
}
