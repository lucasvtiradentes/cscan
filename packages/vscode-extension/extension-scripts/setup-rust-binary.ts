import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BINARY_DIR = path.join(__dirname, '..', 'binaries');

const PLATFORM_MAP: Record<string, string> = {
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
};

function getPlatformTarget(): string | null {
  const platform = `${process.platform}-${process.arch}`;
  const target = PLATFORM_MAP[platform];

  if (!target) {
    console.warn(`Unsupported platform: ${platform}. Lino Rust core will not be available.`);
    return null;
  }

  return target;
}

function ensureBinaryDir(): void {
  if (!fs.existsSync(BINARY_DIR)) {
    fs.mkdirSync(BINARY_DIR, { recursive: true });
  }
}

function getBinaryPath(target: string): string {
  const binaryName = process.platform === 'win32' ? 'lino-server.exe' : 'lino-server';
  return path.join(BINARY_DIR, `${binaryName}-${target}`);
}

function downloadBinary(target: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const version = packageJson.version;
    const binaryName = process.platform === 'win32' ? 'lino-server.exe' : 'lino-server';
    const url = `https://github.com/lucasvtiradentes/lino/releases/download/v${version}/lino-server-${target}${process.platform === 'win32' ? '.exe' : ''}`;

    console.log(`Attempting to download Rust binary from: ${url}`);

    const binaryPath = getBinaryPath(target);
    const file = fs.createWriteStream(binaryPath);

    https
      .get(url, (response) => {
        if (response.statusCode === 404) {
          console.log('Binary not yet available in releases. Skipping download.');
          file.close();
          fs.unlinkSync(binaryPath);
          resolve(false);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          fs.chmodSync(binaryPath, 0o755);
          console.log(`Successfully downloaded and installed Rust binary for ${target}`);
          resolve(true);
        });
      })
      .on('error', (err) => {
        fs.unlinkSync(binaryPath);
        reject(err);
      });
  });
}

function checkLocalBinary(): boolean {
  const localBinaryPath = path.join(__dirname, '..', '..', 'lino-core', 'target', 'debug', 'lino-server');

  if (fs.existsSync(localBinaryPath)) {
    console.log('Found local development Rust binary. Using local build.');
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  console.log('Lino: Checking for Rust binary...');

  ensureBinaryDir();

  if (checkLocalBinary()) {
    console.log('Lino: Development mode - using local Rust binary from packages/lino-core/target/debug/');
    return;
  }

  const target = getPlatformTarget();

  if (!target) {
    console.log('Lino: Rust core not available for this platform. Extension will use TypeScript implementation.');
    return;
  }

  const binaryPath = getBinaryPath(target);

  if (fs.existsSync(binaryPath)) {
    console.log(`Lino: Binary already exists at ${binaryPath}`);
    return;
  }

  try {
    const downloaded = await downloadBinary(target);
    if (!downloaded) {
      console.log(
        'Lino: Binary download skipped. Extension will use TypeScript implementation until Rust core is released.',
      );
    }
  } catch (error) {
    console.warn(`Lino: Failed to download binary: ${(error as Error).message}`);
    console.log('Lino: Extension will use TypeScript implementation.');
  }
}

main().catch(console.error);
