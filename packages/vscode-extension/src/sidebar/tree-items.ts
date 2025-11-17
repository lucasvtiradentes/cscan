import * as vscode from 'vscode';
import { IssueResult, ViewMode, FolderNode } from '../common/types';
import { getFolderIssueCount } from './tree-builder';

export class RuleGroupItem extends vscode.TreeItem {
  constructor(
    public readonly rule: string,
    public readonly results: IssueResult[],
    public readonly viewMode: ViewMode,
  ) {
    super(rule, vscode.TreeItemCollapsibleState.Collapsed);

    this.description = `${results.length} ${results.length === 1 ? 'issue' : 'issues'}`;
    this.iconPath = new vscode.ThemeIcon('list-filter');
    this.contextValue = 'LinoNodeRuleGroup';
  }
}

export class FolderResultItem extends vscode.TreeItem {
  constructor(public readonly node: FolderNode) {
    super(node.name, vscode.TreeItemCollapsibleState.Collapsed);

    const count = getFolderIssueCount(node);
    this.description = `${count} ${count === 1 ? 'issue' : 'issues'}`;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'LinoNodeFolder';
  }
}

export class FileResultItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly results: IssueResult[],
  ) {
    super(
      vscode.workspace.asRelativePath(filePath).split('/').pop() || filePath,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    this.description = `${results.length} ${results.length === 1 ? 'issue' : 'issues'}`;
    this.iconPath = new vscode.ThemeIcon('file');
    this.contextValue = 'LinoNodeFile';
    this.resourceUri = vscode.Uri.file(filePath);
  }
}

export class LineResultItem extends vscode.TreeItem {
  constructor(public readonly result: IssueResult) {
    super(result.text, vscode.TreeItemCollapsibleState.None);

    this.description = `Ln ${result.line + 1}, Col ${result.column + 1}`;
    this.tooltip = result.text;

    this.command = {
      command: 'lino.openFile',
      title: 'Open File',
      arguments: [result.uri, result.line, result.column],
    };

    this.iconPath = new vscode.ThemeIcon(result.type === 'colonAny' ? 'symbol-variable' : 'symbol-keyword');
    this.contextValue = 'LinoNodeIssue';
  }
}
