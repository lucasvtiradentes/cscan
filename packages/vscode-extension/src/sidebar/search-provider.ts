import * as vscode from 'vscode';
import { GroupMode, IssueResult, ViewMode } from '../common/types';
import { buildFolderTree } from './tree-builder';
import { FileResultItem, FolderResultItem, LineResultItem, RuleGroupItem } from './tree-items';

export class SearchResultProvider implements vscode.TreeDataProvider<SearchResultItem> {
  private results: IssueResult[] = [];
  private _viewMode: ViewMode = 'list';
  private _groupMode: GroupMode = 'default';

  private _onDidChangeTreeData = new vscode.EventEmitter<SearchResultItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  set viewMode(mode: ViewMode) {
    this._viewMode = mode;
    this._onDidChangeTreeData.fire();
  }

  get groupMode(): GroupMode {
    return this._groupMode;
  }

  set groupMode(mode: GroupMode) {
    this._groupMode = mode;
    this._onDidChangeTreeData.fire();
  }

  setResults(results: IssueResult[]) {
    this.results = results;
    this._onDidChangeTreeData.fire();
  }

  getResults(): IssueResult[] {
    return this.results;
  }

  getResultCount(): number {
    return this.results.length;
  }

  private groupByRule(): Map<string, IssueResult[]> {
    const grouped = new Map<string, IssueResult[]>();

    for (const result of this.results) {
      const rule = result.rule || 'unknown';
      if (!grouped.has(rule)) {
        grouped.set(rule, []);
      }
      grouped.get(rule)!.push(result);
    }

    return grouped;
  }

  getAllFolderItems(): FolderResultItem[] {
    if (this._viewMode !== 'tree') {
      return [];
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const tree = buildFolderTree(this.results, workspaceRoot);
    const folders: FolderResultItem[] = [];

    const collectFolders = (map: Map<string, any>) => {
      for (const node of map.values()) {
        if (node.type === 'folder') {
          folders.push(new FolderResultItem(node));
          collectFolders(node.children);
        }
      }
    };

    collectFolders(tree);
    return folders;
  }

  getTreeItem(element: SearchResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SearchResultItem): Thenable<SearchResultItem[]> {
    if (!element) {
      if (this._groupMode === 'rule') {
        const grouped = this.groupByRule();
        return Promise.resolve(
          Array.from(grouped.entries()).map(([rule, results]) => new RuleGroupItem(rule, results, this._viewMode)),
        );
      }

      if (this._viewMode === 'list') {
        const grouped = new Map<string, IssueResult[]>();
        for (const result of this.results) {
          const filePath = result.uri.fsPath;
          if (!grouped.has(filePath)) {
            grouped.set(filePath, []);
          }
          grouped.get(filePath)!.push(result);
        }

        return Promise.resolve(
          Array.from(grouped.entries()).map(([path, results]) => new FileResultItem(path, results)),
        );
      } else {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const tree = buildFolderTree(this.results, workspaceRoot);

        const items: SearchResultItem[] = [];
        for (const [name, node] of tree) {
          if (node.type === 'folder') {
            items.push(new FolderResultItem(node));
          } else {
            items.push(new FileResultItem(node.path, node.results));
          }
        }
        return Promise.resolve(items);
      }
    } else if (element instanceof RuleGroupItem) {
      if (element.viewMode === 'list') {
        return Promise.resolve(element.results.map((r) => new LineResultItem(r)));
      } else {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const tree = buildFolderTree(element.results, workspaceRoot);

        const items: SearchResultItem[] = [];
        for (const [name, node] of tree) {
          if (node.type === 'folder') {
            items.push(new FolderResultItem(node));
          } else {
            items.push(new FileResultItem(node.path, node.results));
          }
        }
        return Promise.resolve(items);
      }
    } else if (element instanceof FolderResultItem) {
      const items: SearchResultItem[] = [];
      for (const [name, node] of element.node.children) {
        if (node.type === 'folder') {
          items.push(new FolderResultItem(node));
        } else {
          items.push(new FileResultItem(node.path, node.results));
        }
      }
      return Promise.resolve(items);
    } else if (element instanceof FileResultItem) {
      return Promise.resolve(element.results.map((r) => new LineResultItem(r)));
    }

    return Promise.resolve([]);
  }
}

type SearchResultItem = RuleGroupItem | FolderResultItem | FileResultItem | LineResultItem;
