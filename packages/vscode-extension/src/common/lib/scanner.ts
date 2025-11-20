import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { BINARY_BASE_NAME, PLATFORM_TARGET_MAP, getBinaryName } from '../constants';
import { IssueResult } from '../types';
import { getExtensionPath } from '../utils/extension-helper';
import { LOG_FILE_PATH, logger } from '../utils/logger';
import { RustClient } from './rust-client';
import { getCurrentWorkspaceFolder, openTextDocument } from './vscode-utils';

let rustClient: RustClient | null = null;

export function getRustBinaryPath(): string | null {
  const extensionPath = getExtensionPath();
  if (!extensionPath) {
    logger.error('Extension path not found');
    return null;
  }

  logger.debug(`Extension path: ${extensionPath}`);

  const platform = process.platform;
  const arch = process.arch;
  const target = PLATFORM_TARGET_MAP[`${platform}-${arch}`];
  const binaryName = target ? `${BINARY_BASE_NAME}-${target}${platform === 'win32' ? '.exe' : ''}` : getBinaryName();

  const bundledBinary = join(extensionPath, 'out', 'binaries', binaryName);
  logger.debug(`Checking bundled binary: ${bundledBinary}`);
  if (existsSync(bundledBinary)) {
    logger.info(`Found bundled binary: ${bundledBinary}`);
    return bundledBinary;
  }

  const devBinaryRelease = join(extensionPath, '..', '..', 'core', 'target', 'release', getBinaryName());
  logger.debug(`Checking dev release binary: ${devBinaryRelease}`);
  if (existsSync(devBinaryRelease)) {
    logger.info(`Found dev release binary: ${devBinaryRelease}`);
    return devBinaryRelease;
  }

  const devBinaryDebug = join(extensionPath, '..', '..', 'core', 'target', 'debug', binaryName);
  logger.debug(`Checking dev debug binary: ${devBinaryDebug}`);
  if (existsSync(devBinaryDebug)) {
    logger.info(`Found dev debug binary: ${devBinaryDebug}`);
    return devBinaryDebug;
  }

  logger.error(`Rust binary not found. Searched: ${bundledBinary}, ${devBinaryRelease}, ${devBinaryDebug}`);
  return null;
}

export async function scanWorkspace(fileFilter?: Set<string>, config?: any): Promise<IssueResult[]> {
  const workspaceFolder = getCurrentWorkspaceFolder();
  if (!workspaceFolder) {
    return [];
  }

  const binaryPath = getRustBinaryPath();

  if (!binaryPath) {
    vscode.window
      .showErrorMessage(
        'Tscanner: Rust binary not found. Please build the Rust core:\n\n' +
          'cd packages/core && cargo build --release\n\n' +
          `Check logs at ${LOG_FILE_PATH} for details.`,
        'Open Logs',
      )
      .then((selection) => {
        if (selection === 'Open Logs') {
          openTextDocument(vscode.Uri.file(LOG_FILE_PATH)).then((doc) => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
    throw new Error('Rust binary not found');
  }

  try {
    logger.info('Using Rust backend for scanning');

    if (!rustClient) {
      rustClient = new RustClient(binaryPath);
      await rustClient.start();
    }

    const scanStart = Date.now();
    const results = await rustClient.scan(workspaceFolder.uri.fsPath, fileFilter, config);
    const scanTime = Date.now() - scanStart;
    logger.debug(`scanWorkspace() took ${scanTime}ms to return ${results.length} results`);
    return results;
  } catch (error) {
    logger.error(`Rust backend failed: ${error}`);
    vscode.window
      .showErrorMessage(`Tscanner: Rust backend error: ${error}\n\nCheck logs at ${LOG_FILE_PATH}`, 'Open Logs')
      .then((selection) => {
        if (selection === 'Open Logs') {
          openTextDocument(vscode.Uri.file(LOG_FILE_PATH)).then((doc) => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
    throw error;
  }
}

export async function scanFile(filePath: string): Promise<IssueResult[]> {
  const workspaceFolder = getCurrentWorkspaceFolder();
  if (!workspaceFolder) {
    return [];
  }

  const binaryPath = getRustBinaryPath();
  if (!binaryPath) {
    throw new Error('Rust binary not found');
  }

  try {
    if (!rustClient) {
      rustClient = new RustClient(binaryPath);
      await rustClient.start();
    }

    const results = await rustClient.scanFile(workspaceFolder.uri.fsPath, filePath);
    logger.debug(`scanFile() returned ${results.length} results for ${filePath}`);
    return results;
  } catch (error) {
    logger.error(`Failed to scan file ${filePath}: ${error}`);
    throw error;
  }
}

export async function scanContent(filePath: string, content: string, config?: any): Promise<IssueResult[]> {
  const workspaceFolder = getCurrentWorkspaceFolder();
  if (!workspaceFolder) {
    return [];
  }

  const binaryPath = getRustBinaryPath();
  if (!binaryPath) {
    throw new Error('Rust binary not found');
  }

  try {
    if (!rustClient) {
      rustClient = new RustClient(binaryPath);
      await rustClient.start();
    }

    const results = await rustClient.scanContent(workspaceFolder.uri.fsPath, filePath, content, config);
    logger.debug(`scanContent() returned ${results.length} results for ${filePath}`);
    return results;
  } catch (error) {
    logger.error(`Failed to scan content for ${filePath}: ${error}`);
    throw error;
  }
}

export async function clearCache(): Promise<void> {
  if (!rustClient) {
    const binaryPath = getRustBinaryPath();
    if (!binaryPath) {
      throw new Error('Rust binary not found');
    }
    rustClient = new RustClient(binaryPath);
    await rustClient.start();
  }

  await rustClient.clearCache();
  logger.info('Cache cleared via RPC');
}

export function dispose() {
  if (rustClient) {
    rustClient.stop();
    rustClient = null;
  }
}
