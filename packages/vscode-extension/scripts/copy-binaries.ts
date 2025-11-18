import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

class PostBuild {
  private readonly extensionRoot: string;
  private readonly outDir: string;
  private readonly binariesDir: string;

  constructor() {
    this.extensionRoot = resolve(__dirname, '..');
    this.outDir = join(this.extensionRoot, 'out');
    this.binariesDir = join(this.extensionRoot, 'binaries');
  }

  async execute() {
    console.log('Running vscode-extension postbuild...');
    this.copyBinaries();
    console.log('✅ Postbuild complete!');
  }

  private copyBinaries() {
    console.log('Copying Rust binaries...');

    if (!existsSync(this.binariesDir)) {
      console.warn('⚠️  Binaries folder not found at:', this.binariesDir);
      console.log('This is expected during development. Binaries will be downloaded on extension install.');
      return;
    }

    const binariesDest = join(this.outDir, 'binaries');
    if (!existsSync(binariesDest)) {
      mkdirSync(binariesDest, { recursive: true });
    }

    const files = readdirSync(this.binariesDir);
    if (files.length === 0) {
      console.warn('⚠️  No binaries found in binaries folder');
      console.log('This is expected during development. Binaries will be downloaded on extension install.');
      return;
    }

    for (const file of files) {
      if (file.startsWith('lino-server-')) {
        const src = join(this.binariesDir, file);
        const dest = join(binariesDest, file);
        copyFileSync(src, dest);
        console.log(`✅ Copied ${file}`);
      }
    }
  }
}

const postBuild = new PostBuild();
postBuild.execute().catch((err) => {
  throw new Error(err);
});
