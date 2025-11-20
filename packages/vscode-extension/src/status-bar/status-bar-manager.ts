import * as vscode from 'vscode';
import { getCommandId, getStatusBarName } from '../common/constants';
import { loadEffectiveConfig } from '../common/lib/config-manager';
import { Command, ScanMode, getCurrentWorkspaceFolder } from '../common/lib/vscode-utils';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private context: vscode.ExtensionContext,
    private currentScanModeRef: { current: ScanMode },
    private currentCompareBranchRef: { current: string },
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = getCommandId(Command.OpenSettingsMenu);
  }

  async update(): Promise<void> {
    const workspaceFolder = getCurrentWorkspaceFolder();

    if (!workspaceFolder) {
      this.statusBarItem.hide();
      return;
    }

    let hasConfig = false;
    const config = await loadEffectiveConfig(this.context, workspaceFolder.uri.fsPath);
    hasConfig = config !== null && Object.keys(config.rules).length > 0;

    const icon = hasConfig ? '$(gear)' : '$(warning)';
    const modeText = this.currentScanModeRef.current === ScanMode.Workspace ? 'Codebase' : 'Branch';
    const branchText =
      this.currentScanModeRef.current === ScanMode.Branch ? ` (${this.currentCompareBranchRef.current})` : '';
    const configWarning = hasConfig ? '' : ' [No rules configured]';

    this.statusBarItem.text = `${icon} ${getStatusBarName()}: ${modeText}${branchText}${configWarning}`;
    this.statusBarItem.tooltip = hasConfig
      ? 'Click to change scan settings'
      : 'No rules configured. Click to set up rules.';

    this.statusBarItem.show();
  }

  getDisposable(): vscode.Disposable {
    return this.statusBarItem;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
