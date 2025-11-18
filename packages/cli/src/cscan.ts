#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const PLATFORM_MAP: Record<string, string> = {
  'linux-x64': '@cscan/linux-x64',
  'linux-arm64': '@cscan/linux-arm64',
  'darwin-x64': '@cscan/darwin-x64',
  'darwin-arm64': '@cscan/darwin-arm64',
  'win32-x64': '@cscan/win32-x64',
};

function getPlatformKey(): string {
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

  throw new Error(
    `Unsupported platform: ${platform}-${arch}\n` +
      `cscan is only available for:\n` +
      `  - Linux (x64, arm64)\n` +
      `  - macOS (x64, arm64)\n` +
      `  - Windows (x64)`,
  );
}

function getBinaryPath(): string {
  const platformKey = getPlatformKey();
  const packageName = PLATFORM_MAP[platformKey];

  const localPath = join(
    __dirname,
    '..',
    '..',
    'npm',
    platformKey,
    'cscan' + (process.platform === 'win32' ? '.exe' : ''),
  );
  if (existsSync(localPath)) {
    return localPath;
  }

  try {
    const binaryPath = require.resolve(`${packageName}/cscan` + (process.platform === 'win32' ? '.exe' : ''));
    return binaryPath;
  } catch (e) {
    const error = e as Error;
    throw new Error(
      `Failed to find cscan binary for ${platformKey}\n` +
        `Please try reinstalling: npm install cscan\n` +
        `Error: ${error.message}`,
    );
  }
}

function main(): void {
  try {
    const binaryPath = getBinaryPath();

    const child = spawn(binaryPath, process.argv.slice(2), {
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code || 0);
      }
    });

    process.on('SIGINT', () => {
      child.kill('SIGINT');
      child.kill('SIGTERM');
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  } catch (error) {
    const err = error as Error;
    console.error(err.message);
    process.exit(1);
  }
}

main();
