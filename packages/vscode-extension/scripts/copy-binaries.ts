import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BINARY_BASE_NAME, PLATFORM_TARGET_MAP, getBinaryName } from '../src/common/constants';

const extensionRoot = resolve(__dirname, '..');
const outBinariesDir = join(extensionRoot, 'out', 'binaries');
const rustCoreDir = join(extensionRoot, '..', 'cscan-core');

console.log('Copying Rust binaries to out/binaries...');

const binaryName = getBinaryName();
const releaseBinary = join(rustCoreDir, 'target', 'release', binaryName);
const debugBinary = join(rustCoreDir, 'target', 'debug', binaryName);

const sourceBinary = existsSync(releaseBinary) ? releaseBinary : existsSync(debugBinary) ? debugBinary : null;

if (!sourceBinary) {
  console.warn('⚠️  Rust binary not found');
  console.log('Run: cd packages/cscan-core && cargo build --release');
} else {
  if (!existsSync(outBinariesDir)) {
    mkdirSync(outBinariesDir, { recursive: true });
  }

  const platform = process.platform;
  const arch = process.arch;
  const target = PLATFORM_TARGET_MAP[`${platform}-${arch}`];
  const destBinaryName = target ? `${BINARY_BASE_NAME}-${target}${platform === 'win32' ? '.exe' : ''}` : binaryName;
  const destBinary = join(outBinariesDir, destBinaryName);

  copyFileSync(sourceBinary, destBinary);
  console.log(`✅ Copied ${sourceBinary.includes('release') ? 'release' : 'debug'} binary to out/binaries/`);
}

const existingBinaries = existsSync(outBinariesDir)
  ? readdirSync(outBinariesDir).filter((f) => f.startsWith(BINARY_BASE_NAME))
  : [];
if (existingBinaries.length > 0) {
  console.log(`\n📦 Binaries in out/binaries/ (${existingBinaries.length}):`);
  existingBinaries.forEach((f) => console.log(`   - ${f}`));
}

console.log('\n✅ Copy binaries complete!');
