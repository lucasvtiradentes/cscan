import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { logger } from '../utils/logger';

export interface LinoConfig {
  rules: Record<string, any>;
  include: string[];
  exclude: string[];
}

function getWorkspaceHash(workspacePath: string): string {
  return createHash('md5').update(workspacePath).digest('hex').substring(0, 16);
}

export function getGlobalConfigDir(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, 'configs');
}

export function getGlobalConfigPath(context: vscode.ExtensionContext, workspacePath: string): vscode.Uri {
  const workspaceHash = getWorkspaceHash(workspacePath);
  return vscode.Uri.joinPath(getGlobalConfigDir(context), workspaceHash, 'rules.json');
}

export function getLocalConfigPath(workspacePath: string): vscode.Uri {
  return vscode.Uri.joinPath(vscode.Uri.file(workspacePath), '.lino', 'rules.json');
}

export async function hasLocalConfig(workspacePath: string): Promise<boolean> {
  const localPath = getLocalConfigPath(workspacePath);
  try {
    await vscode.workspace.fs.stat(localPath);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(configPath: vscode.Uri): Promise<LinoConfig | null> {
  try {
    const data = await vscode.workspace.fs.readFile(configPath);
    return JSON.parse(Buffer.from(data).toString('utf8'));
  } catch (error) {
    logger.debug(`Failed to load config from ${configPath.fsPath}: ${error}`);
    return null;
  }
}

export async function getEffectiveConfigPath(
  context: vscode.ExtensionContext,
  workspacePath: string,
): Promise<vscode.Uri> {
  const hasLocal = await hasLocalConfig(workspacePath);
  if (hasLocal) {
    logger.info(`Using local config for workspace: ${workspacePath}`);
    return getLocalConfigPath(workspacePath);
  }

  logger.info(`Using global config for workspace: ${workspacePath}`);
  return getGlobalConfigPath(context, workspacePath);
}

export async function loadEffectiveConfig(
  context: vscode.ExtensionContext,
  workspacePath: string,
): Promise<LinoConfig | null> {
  const configPath = await getEffectiveConfigPath(context, workspacePath);
  return loadConfig(configPath);
}

export async function saveGlobalConfig(
  context: vscode.ExtensionContext,
  workspacePath: string,
  config: LinoConfig,
): Promise<void> {
  const configPath = getGlobalConfigPath(context, workspacePath);
  const configDir = vscode.Uri.joinPath(configPath, '..');

  await vscode.workspace.fs.createDirectory(configDir);
  await vscode.workspace.fs.writeFile(configPath, Buffer.from(JSON.stringify(config, null, 2)));

  logger.info(`Saved global config for workspace: ${workspacePath} at ${configPath.fsPath}`);
}

export async function saveLocalConfig(workspacePath: string, config: LinoConfig): Promise<void> {
  const localConfigDir = vscode.Uri.joinPath(vscode.Uri.file(workspacePath), '.lino');
  const localConfigPath = getLocalConfigPath(workspacePath);

  await vscode.workspace.fs.createDirectory(localConfigDir);
  await vscode.workspace.fs.writeFile(localConfigPath, Buffer.from(JSON.stringify(config, null, 2)));

  logger.info(`Saved local config for workspace: ${workspacePath}`);
}

export function getDefaultConfig(): LinoConfig {
  return {
    rules: {},
    include: ['**/*.ts', '**/*.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
  };
}

const AUTO_MANAGED_MARKER = '// AUTO-MANAGED BY LINO EXTENSION - DO NOT EDIT THIS LINE';

export function isAutoManagedConfig(configContent: string): boolean {
  return configContent.includes(AUTO_MANAGED_MARKER);
}

export function addAutoManagedMarker(config: LinoConfig): string {
  const lines = JSON.stringify(config, null, 2).split('\n');
  lines.splice(1, 0, `  "${AUTO_MANAGED_MARKER}": true,`);
  return lines.join('\n');
}

export async function syncGlobalToLocal(context: vscode.ExtensionContext, workspacePath: string): Promise<void> {
  const localPath = getLocalConfigPath(workspacePath);

  try {
    const stat = await vscode.workspace.fs.stat(localPath);
    const existingContent = await vscode.workspace.fs.readFile(localPath);
    const contentStr = Buffer.from(existingContent).toString('utf8');

    if (!isAutoManagedConfig(contentStr)) {
      logger.info(`Local config exists and is user-managed, skipping sync for ${workspacePath}`);
      return;
    }
  } catch {}

  const globalConfig = await loadConfig(getGlobalConfigPath(context, workspacePath));
  if (!globalConfig) {
    logger.debug(`No global config found for ${workspacePath}, skipping sync`);
    return;
  }

  const localConfigDir = vscode.Uri.joinPath(vscode.Uri.file(workspacePath), '.lino');
  await vscode.workspace.fs.createDirectory(localConfigDir);

  const configWithMarker = addAutoManagedMarker(globalConfig);
  await vscode.workspace.fs.writeFile(localPath, Buffer.from(configWithMarker));

  logger.info(`Synced global config to local .lino/rules.json for ${workspacePath}`);
}

export async function shouldSyncToLocal(workspacePath: string): Promise<boolean> {
  const localPath = getLocalConfigPath(workspacePath);

  try {
    const existingContent = await vscode.workspace.fs.readFile(localPath);
    const contentStr = Buffer.from(existingContent).toString('utf8');
    return isAutoManagedConfig(contentStr);
  } catch {
    return true;
  }
}

export async function ensureLocalConfigForScan(
  context: vscode.ExtensionContext,
  workspacePath: string,
): Promise<boolean> {
  const localPath = getLocalConfigPath(workspacePath);

  try {
    await vscode.workspace.fs.stat(localPath);
    logger.debug('Local config already exists, using it for scan');
    return true;
  } catch {
    const globalConfig = await loadConfig(getGlobalConfigPath(context, workspacePath));
    if (!globalConfig) {
      logger.info('No config found (neither local nor global)');
      return false;
    }

    await syncGlobalToLocal(context, workspacePath);
    logger.info('Synced global config to local .lino/rules.json for Rust scanner');
    return true;
  }
}
