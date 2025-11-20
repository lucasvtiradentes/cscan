import type { BuildOptions } from 'esbuild';
import esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const isDev = !process.env.CI;

const extensionBuildOptions: BuildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
  define: {
    __IS_DEV_BUILD__: isDev ? 'true' : 'false',
  },
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(extensionBuildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(extensionBuildOptions);
    console.log('Build complete!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
