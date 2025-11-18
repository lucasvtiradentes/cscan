#!/usr/bin/env node

const PLATFORM_MAP: Record<string, string> = {
  'linux-x64': '@cscan/linux-x64',
  'linux-arm64': '@cscan/linux-arm64',
  'darwin-x64': '@cscan/darwin-x64',
  'darwin-arm64': '@cscan/darwin-arm64',
  'win32-x64': '@cscan/win32-x64',
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
    `\nWarning: cscan does not have a prebuilt binary for ${process.platform}-${process.arch}\n` +
      `Supported platforms:\n` +
      `  - Linux (x64, arm64)\n` +
      `  - macOS (x64, arm64)\n` +
      `  - Windows (x64)\n`,
  );
  process.exit(0);
}

const packageName = PLATFORM_MAP[platformKey];

try {
  require.resolve(packageName);
  console.log(`✅ cscan binary installed successfully (${platformKey})`);
} catch (e) {
  console.warn(
    `\nWarning: Failed to install cscan binary for ${platformKey}\n` +
      `Expected package: ${packageName}\n` +
      `This might happen if optional dependencies were not installed.\n`,
  );
}
