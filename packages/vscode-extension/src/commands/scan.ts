import * as vscode from 'vscode';
import { clearCache } from '../common/lib/scanner';
import {
  Command,
  ToastKind,
  executeCommand,
  getCurrentWorkspaceFolder,
  registerCommand,
  showToastMessage,
} from '../common/lib/vscode-utils';
import { invalidateCache } from '../common/utils/git-helper';
import { logger } from '../common/utils/logger';

export function createRefreshCommand() {
  return registerCommand(Command.Refresh, async () => {
    await executeCommand(Command.FindIssue);
  });
}

export function createHardScanCommand(isSearchingRef: { current: boolean }) {
  return registerCommand(Command.HardScan, async () => {
    if (isSearchingRef.current) {
      showToastMessage(ToastKind.Warning, 'Search already in progress');
      return;
    }

    const workspaceFolder = getCurrentWorkspaceFolder();
    if (!workspaceFolder) {
      showToastMessage(ToastKind.Error, 'No workspace folder open');
      return;
    }

    logger.info('Starting hard scan (clearing cache)');

    try {
      await clearCache();
      invalidateCache();
      showToastMessage(ToastKind.Info, 'Cache cleared, rescanning...');
      await executeCommand(Command.FindIssue);
    } catch (error) {
      logger.error(`Hard scan failed: ${error}`);
      showToastMessage(ToastKind.Error, `Hard scan failed: ${error}`);
    }
  });
}
