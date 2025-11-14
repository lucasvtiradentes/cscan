import * as vscode from 'vscode';
import { clearCache } from '../lib/scanner';
import { invalidateCache } from '../utils/gitHelper';
import { logger } from '../utils/logger';

export function createRefreshCommand() {
  return vscode.commands.registerCommand('lino.refresh', async () => {
    await vscode.commands.executeCommand('lino.findIssue');
  });
}

export function createHardScanCommand(isSearchingRef: { current: boolean }) {
  return vscode.commands.registerCommand('lino.hardScan', async () => {
    if (isSearchingRef.current) {
      vscode.window.showWarningMessage('Search already in progress');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    logger.info('Starting hard scan (clearing cache)');

    try {
      await clearCache();
      invalidateCache();
      vscode.window.showInformationMessage('Cache cleared, rescanning...');
      await vscode.commands.executeCommand('lino.findIssue');
    } catch (error) {
      logger.error(`Hard scan failed: ${error}`);
      vscode.window.showErrorMessage(`Hard scan failed: ${error}`);
    }
  });
}
