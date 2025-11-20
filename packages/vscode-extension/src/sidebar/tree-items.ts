import * as vscode from 'vscode';
import { getCommandId } from '../common/constants';
import { Command, TreeItemContextValue, ViewMode } from '../common/lib/vscode-utils';
import { FolderNode, IssueResult, NodeKind } from '../common/types';
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
    this.contextValue = TreeItemContextValue.RuleGroup;
  }
}

export class FolderResultItem extends vscode.TreeItem {
  constructor(public readonly node: FolderNode) {
    super(node.name, vscode.TreeItemCollapsibleState.Collapsed);

    const count = getFolderIssueCount(node);
    this.description = `${count} ${count === 1 ? 'issue' : 'issues'}`;
    this.iconPath = new vscode.ThemeIcon(NodeKind.Folder);
    this.contextValue = TreeItemContextValue.Folder;
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
    this.iconPath = new vscode.ThemeIcon(NodeKind.File);
    this.contextValue = TreeItemContextValue.File;
    this.resourceUri = vscode.Uri.file(filePath);
  }
}

export class LineResultItem extends vscode.TreeItem {
  constructor(public readonly result: IssueResult) {
    super(result.text, vscode.TreeItemCollapsibleState.None);

    this.description = `Ln ${result.line + 1}, Col ${result.column + 1}`;
    this.tooltip = result.text;

    this.command = {
      command: getCommandId(Command.OpenFile),
      title: 'Open File',
      arguments: [result.uri, result.line, result.column],
    };

    this.iconPath = new vscode.ThemeIcon('symbol-variable');
    this.contextValue = TreeItemContextValue.Issue;
  }
}
