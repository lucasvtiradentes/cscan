import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { BINARY_BASE_NAME, PLATFORM_TARGET_MAP, getBinaryName } from '../src/common/constants';

const BINARY_DIR = path.join(__dirname, '..', 'binaries');

function getPlatformTarget(): string | null {
  const platform = `${process.platform}-${process.arch}`;
  const target = PLATFORM_TARGET_MAP[platform];

  if (!target) {
    console.warn(`Unsupported platform: ${platform}. Cscan Rust core will not be available.`);
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
  return path.join(BINARY_DIR, `${getBinaryName()}-${target}`);
}

function downloadBinary(target: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const version = packageJson.version;
    const url = `https://github.com/lucasvtiradentes/cscan/releases/download/v${version}/${BINARY_BASE_NAME}-${target}${process.platform === 'win32' ? '.exe' : ''}`;

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
  const localBinaryPath = path.join(__dirname, '..', '..', 'cscan-core', 'target', 'debug', getBinaryName());

  if (fs.existsSync(localBinaryPath)) {
    console.log('Found local development Rust binary. Using local build.');
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  console.log('Cscan: Checking for Rust binary...');

  ensureBinaryDir();

  if (checkLocalBinary()) {
    console.log('Cscan: Development mode - using local Rust binary from packages/cscan-core/target/debug/');
    return;
  }

  const target = getPlatformTarget();

  if (!target) {
    console.log('Cscan: Rust core not available for this platform. Extension will use TypeScript implementation.');
    return;
  }

  const binaryPath = getBinaryPath(target);

  if (fs.existsSync(binaryPath)) {
    console.log(`Cscan: Binary already exists at ${binaryPath}`);
    return;
  }

  try {
    const downloaded = await downloadBinary(target);
    if (!downloaded) {
      console.log(
        'Cscan: Binary download skipped. Extension will use TypeScript implementation until Rust core is released.',
      );
    }
  } catch (error) {
    console.warn(`Cscan: Failed to download binary: ${(error as Error).message}`);
    console.log('Cscan: Extension will use TypeScript implementation.');
  }
}

main().catch(console.error);
