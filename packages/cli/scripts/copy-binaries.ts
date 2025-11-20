import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { arch, platform } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRIPT_DIR = __dirname;
const CLI_DIR = join(SCRIPT_DIR, '..');
const TSCANNER_CORE_DIR = join(CLI_DIR, '..', 'core');

console.log('📦 Copying Rust binary for current platform...');

const OS = platform();
const ARCH = arch();

let NPM_PLATFORM: string | undefined;

if (OS === 'linux') {
  if (ARCH === 'x64') {
    NPM_PLATFORM = 'linux-x64';
  } else if (ARCH === 'arm64') {
    NPM_PLATFORM = 'linux-arm64';
  }
} else if (OS === 'darwin') {
  if (ARCH === 'x64') {
    NPM_PLATFORM = 'darwin-x64';
  } else if (ARCH === 'arm64') {
    NPM_PLATFORM = 'darwin-arm64';
  }
} else if (OS === 'win32') {
  NPM_PLATFORM = 'win32-x64';
}

if (!NPM_PLATFORM) {
  console.log(`⚠️  Unsupported platform: ${OS}-${ARCH}`);
  console.log('Skipping binary copy...');
  process.exit(0);
}

let SOURCE_PATH = join(TSCANNER_CORE_DIR, 'target', 'release', 'tscanner');
if (NPM_PLATFORM.startsWith('win32')) {
  SOURCE_PATH += '.exe';
}

const DEST_DIR = join(CLI_DIR, 'npm', NPM_PLATFORM);
let DEST_PATH = join(DEST_DIR, 'tscanner');
if (NPM_PLATFORM.startsWith('win32')) {
  DEST_PATH += '.exe';
}

if (existsSync(SOURCE_PATH)) {
  mkdirSync(DEST_DIR, { recursive: true });
  copyFileSync(SOURCE_PATH, DEST_PATH);

  try {
    chmodSync(DEST_PATH, 0o755);
  } catch {}

  console.log(`✅ Copied binary for ${NPM_PLATFORM}`);
} else {
  console.log(`⚠️  Binary not found: ${SOURCE_PATH}`);
  console.log('Skipping binary copy (not built yet)');
}

console.log('');
console.log('✅ Build complete!');
