import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CONTEXT_PREFIX, DEV_SUFFIX, EXTENSION_ID_DEV } from '../src/common/constants';

if (process.env.CI || process.env.GITHUB_ACTIONS) {
  console.log('Skipping local installation in CI environment');
  process.exit(0);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const targetDir = join(homedir(), '.vscode', 'extensions', EXTENSION_ID_DEV);

console.log('Installing extension locally...');

if (existsSync(targetDir)) {
  rmSync(targetDir, { recursive: true });
}

mkdirSync(targetDir, { recursive: true });

function copyRecursive(src: string, dest: string): void {
  const stat = statSync(src);

  if (stat.isDirectory()) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    const entries = readdirSync(src);
    for (const entry of entries) {
      copyRecursive(join(src, entry), join(dest, entry));
    }
  } else {
    copyFileSync(src, dest);
  }
}

function addDevSuffix(str: string): string {
  return `${str}${DEV_SUFFIX}`;
}

function addDevLabel(str: string): string {
  return `${str} (Dev)`;
}

function applyDevTransformations(pkg: Record<string, unknown>): Record<string, unknown> {
  const transformed = { ...pkg };

  transformed.name = `${pkg.name}-dev`;
  transformed.displayName = addDevLabel(pkg.displayName as string);

  const contributes = transformed.contributes as Record<string, unknown>;
  if (!contributes) return transformed;

  if (contributes.viewsContainers) {
    const containers = contributes.viewsContainers as Record<string, unknown>;
    if (containers.activitybar) {
      containers.activitybar = (containers.activitybar as Array<{ id: string; title: string }>).map((container) => ({
        ...container,
        id: addDevSuffix(container.id),
        title: addDevLabel(container.title),
      }));
    }
  }

  if (contributes.views) {
    const views = contributes.views as Record<string, Array<{ id: string; name?: string }>>;
    const newViews: Record<string, unknown> = {};

    for (const [containerKey, viewList] of Object.entries(views)) {
      const newContainerKey = addDevSuffix(containerKey);
      newViews[newContainerKey] = viewList.map((view) => ({
        ...view,
        id: addDevSuffix(view.id),
        name: view.name ? addDevLabel(view.name) : undefined,
      }));
    }

    contributes.views = newViews;
  }

  if (contributes.menus) {
    const menus = contributes.menus as Record<string, Array<{ when?: string; command?: string }>>;

    for (const menuList of Object.values(menus)) {
      for (const menu of menuList) {
        if (menu.when) {
          menu.when = menu.when.replace(/(\w+)(?=\s|$|==)/g, (match) => {
            if (match.startsWith(CONTEXT_PREFIX) && !match.endsWith(DEV_SUFFIX)) {
              return addDevSuffix(match);
            }
            return match;
          });
        }
        if (menu.command && menu.command.startsWith(`${CONTEXT_PREFIX}.`)) {
          menu.command = menu.command.replace(`${CONTEXT_PREFIX}.`, `${addDevSuffix(CONTEXT_PREFIX)}.`);
        }
      }
    }
  }

  if (contributes.commands) {
    const commands = contributes.commands as Array<{ command: string; title?: string; enablement?: string }>;
    for (const cmd of commands) {
      if (cmd.command.startsWith(`${CONTEXT_PREFIX}.`)) {
        cmd.command = cmd.command.replace(`${CONTEXT_PREFIX}.`, `${addDevSuffix(CONTEXT_PREFIX)}.`);
      }
      if (cmd.title && cmd.title.startsWith('Cscan:')) {
        cmd.title = cmd.title.replace('Cscan:', 'Cscan (Dev):');
      }
      if (cmd.enablement) {
        cmd.enablement = cmd.enablement.replace(/(\w+)(?=\s|$|==)/g, (match) => {
          if (match.startsWith(CONTEXT_PREFIX) && !match.endsWith(DEV_SUFFIX)) {
            return addDevSuffix(match);
          }
          return match;
        });
      }
    }
  }

  if (contributes.keybindings) {
    const keybindings = contributes.keybindings as Array<{ when?: string; command?: string }>;
    for (const binding of keybindings) {
      if (binding.when) {
        binding.when = binding.when.replace(/(\w+)(?=\s|$|==)/g, (match) => {
          if (match.startsWith(CONTEXT_PREFIX) && !match.endsWith(DEV_SUFFIX)) {
            return addDevSuffix(match);
          }
          return match;
        });
      }
      if (binding.command && binding.command.startsWith(`${CONTEXT_PREFIX}.`)) {
        binding.command = binding.command.replace(`${CONTEXT_PREFIX}.`, `${addDevSuffix(CONTEXT_PREFIX)}.`);
      }
    }
  }

  return transformed;
}

copyRecursive('out', join(targetDir, 'out'));
copyRecursive('resources', join(targetDir, 'resources'));

const extensionJs = readFileSync(join(targetDir, 'out', 'extension.js'), 'utf8');
const devSuffixPattern = /Qe="Dev",([A-Za-z]+)=!1/;
const patchedExtensionJs = extensionJs.replace(devSuffixPattern, 'Qe="Dev",$1=!0');
writeFileSync(join(targetDir, 'out', 'extension.js'), patchedExtensionJs);

const modifiedPackageJson = applyDevTransformations(packageJson);
writeFileSync(join(targetDir, 'package.json'), JSON.stringify(modifiedPackageJson, null, 2));

if (existsSync('LICENSE')) {
  copyFileSync('LICENSE', join(targetDir, 'LICENSE'));
}

if (existsSync('README.md')) {
  copyFileSync('README.md', join(targetDir, 'README.md'));
}

console.log(`\n✅ Extension installed to: ${targetDir}`);
console.log(`   Extension ID: ${EXTENSION_ID_DEV}`);
console.log(`\n🔄 Reload VSCode to activate the extension:`);
console.log(`   - Press Ctrl+Shift+P`);
console.log(`   - Type "Reload Window" and press Enter\n`);
