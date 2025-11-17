import * as vscode from 'vscode';
import { loadEffectiveConfig } from '../common/lib/config-manager';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private context: vscode.ExtensionContext,
    private currentScanModeRef: { current: 'workspace' | 'branch' },
    private currentCompareBranchRef: { current: string },
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = 'lino.openSettingsMenu';
  }

  async update(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      this.statusBarItem.hide();
      return;
    }

    let hasConfig = false;
    const config = await loadEffectiveConfig(this.context, workspaceFolder.uri.fsPath);
    hasConfig = config !== null && Object.keys(config.rules).length > 0;

    const icon = hasConfig ? '$(gear)' : '$(warning)';
    const modeText = this.currentScanModeRef.current === 'workspace' ? 'Codebase' : 'Branch';
    const branchText = this.currentScanModeRef.current === 'branch' ? ` (${this.currentCompareBranchRef.current})` : '';
    const configWarning = hasConfig ? '' : ' [No rules configured]';

    this.statusBarItem.text = `${icon} Lino: ${modeText}${branchText}${configWarning}`;
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
