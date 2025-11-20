import * as vscode from 'vscode';
import { getGlobalConfigPath, getLocalConfigPath } from '../common/lib/config-manager';
import {
  Command,
  ToastKind,
  executeCommand,
  getCurrentWorkspaceFolder,
  openTextDocument,
  registerCommand,
  showToastMessage,
  updateState,
} from '../common/lib/vscode-utils';
import { getAllBranches, getCurrentBranch, invalidateCache } from '../common/utils/git-helper';
import { logger } from '../common/utils/logger';
import { SearchResultProvider } from '../sidebar/search-provider';

export function createOpenSettingsMenuCommand(
  updateStatusBar: () => Promise<void>,
  currentScanModeRef: { current: 'workspace' | 'branch' },
  currentCompareBranchRef: { current: string },
  context: vscode.ExtensionContext,
  searchProvider: SearchResultProvider,
) {
  return registerCommand(Command.OpenSettingsMenu, async () => {
    logger.info('openSettingsMenu command called');
    const mainMenuItems: vscode.QuickPickItem[] = [
      {
        label: '$(checklist) Manage Rules',
        detail: 'Enable/disable built-in rules and generate configuration',
      },
      {
        label: '$(gear) Manage Scan Settings',
        detail: 'Choose between Codebase or Branch scan mode',
      },
      {
        label: '$(edit) Open Project Cscanner Configs',
        detail: 'Edit .cscanner/rules.json or global extension config',
      },
    ];

    const selected = await vscode.window.showQuickPick(mainMenuItems, {
      placeHolder: 'Cscanner Settings',
      ignoreFocusOut: false,
    });

    if (!selected) return;

    if (selected.label.includes('Manage Rules')) {
      await executeCommand(Command.ManageRules);
      return;
    }

    if (selected.label.includes('Manage Scan Settings')) {
      await showScanSettingsMenu(updateStatusBar, currentScanModeRef, currentCompareBranchRef, context, searchProvider);
      return;
    }

    if (selected.label.includes('Open Project Cscanner Configs')) {
      await openProjectCscannerConfigs(context);
      return;
    }
  });
}

async function openProjectCscannerConfigs(context: vscode.ExtensionContext) {
  const workspaceFolder = getCurrentWorkspaceFolder();

  if (!workspaceFolder) {
    showToastMessage(ToastKind.Error, 'No workspace folder open');
    return;
  }

  const localConfigPath = getLocalConfigPath(workspaceFolder.uri.fsPath);
  try {
    await vscode.workspace.fs.stat(localConfigPath);
    const doc = await openTextDocument(localConfigPath);
    await vscode.window.showTextDocument(doc);
    return;
  } catch {
    logger.debug('Local config not found, trying global config');
  }

  const globalConfigPath = getGlobalConfigPath(context, workspaceFolder.uri.fsPath);
  try {
    await vscode.workspace.fs.stat(globalConfigPath);
    const doc = await openTextDocument(globalConfigPath);
    await vscode.window.showTextDocument(doc);
    return;
  } catch {
    logger.debug('Global config not found');
  }

  showToastMessage(ToastKind.Error, 'No Cscanner configuration found. Create one via "Manage Rules" first.');
}

async function showScanSettingsMenu(
  updateStatusBar: () => Promise<void>,
  currentScanModeRef: { current: 'workspace' | 'branch' },
  currentCompareBranchRef: { current: string },
  context: vscode.ExtensionContext,
  searchProvider: SearchResultProvider,
) {
  const scanModeItems: vscode.QuickPickItem[] = [
    {
      label: '$(file-directory) Codebase',
      description: currentScanModeRef.current === 'workspace' ? '✓ Active' : '',
      detail: 'Scan all files in workspace',
    },
    {
      label: '$(git-branch) Branch',
      description: currentScanModeRef.current === 'branch' ? '✓ Active' : '',
      detail: 'Scan only changed files in current branch',
    },
  ];

  const selected = await vscode.window.showQuickPick(scanModeItems, {
    placeHolder: 'Change checking mode',
    ignoreFocusOut: false,
  });

  if (!selected) return;

  if (selected.label.includes('Codebase')) {
    searchProvider.setResults([]);
    currentScanModeRef.current = 'workspace';
    updateState(context, 'scanMode', 'workspace');
    invalidateCache();
    updateStatusBar();
    executeCommand(Command.FindIssue);
  } else if (selected.label.includes('Branch')) {
    const workspaceFolder = getCurrentWorkspaceFolder();
    if (!workspaceFolder) {
      showToastMessage(ToastKind.Error, 'No workspace folder open');
      return;
    }

    const currentBranch = await getCurrentBranch(workspaceFolder.uri.fsPath);
    if (!currentBranch) {
      showToastMessage(ToastKind.Error, 'Not in a git repository');
      return;
    }

    const branchOptions: vscode.QuickPickItem[] = [
      {
        label: `Current value: ${currentCompareBranchRef.current}`,
        description: '✓',
        detail: 'Currently comparing against this branch',
      },
      {
        label: '$(list-selection) Choose another branch',
        detail: 'Select a different branch to compare against',
      },
    ];

    const branchSelected = await vscode.window.showQuickPick(branchOptions, {
      placeHolder: 'Branch settings',
      ignoreFocusOut: false,
    });

    if (!branchSelected) return;

    if (branchSelected.label.includes('Choose another branch')) {
      const branches = await getAllBranches(workspaceFolder.uri.fsPath);

      if (branches.length === 0) {
        showToastMessage(ToastKind.Error, 'No branches found');
        return;
      }

      const otherBranches = branches.filter((b) => b !== currentBranch);

      const localBranches = otherBranches.filter((b) => !b.startsWith('origin/'));
      const remoteBranches = otherBranches.filter((b) => b.startsWith('origin/'));

      const branchItems: vscode.QuickPickItem[] = [];

      if (localBranches.length > 0) {
        branchItems.push(
          { label: 'Branches', kind: vscode.QuickPickItemKind.Separator },
          ...localBranches.map((branch) => ({
            label: `$(git-branch) ${branch}`,
            description: branch === currentCompareBranchRef.current ? '$(check) Current compare target' : '',
            detail: branch,
          })),
        );
      }

      if (remoteBranches.length > 0) {
        branchItems.push(
          { label: 'Remote branches', kind: vscode.QuickPickItemKind.Separator },
          ...remoteBranches.map((branch) => ({
            label: `$(cloud) ${branch}`,
            description: branch === currentCompareBranchRef.current ? '$(check) Current compare target' : '',
            detail: branch,
          })),
        );
      }

      const selectedBranch = await vscode.window.showQuickPick(branchItems, {
        placeHolder: `Select branch to compare against (current: ${currentBranch})`,
        matchOnDescription: true,
        matchOnDetail: true,
        ignoreFocusOut: true,
      });

      if (!selectedBranch || !selectedBranch.detail) return;

      currentCompareBranchRef.current = selectedBranch.detail;
      updateState(context, 'compareBranch', currentCompareBranchRef.current);
    }

    searchProvider.setResults([]);
    currentScanModeRef.current = 'branch';
    updateState(context, 'scanMode', 'branch');
    invalidateCache();
    updateStatusBar();
    executeCommand(Command.FindIssue);
  }
}
