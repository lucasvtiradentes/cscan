import * as vscode from 'vscode';
import { SearchResultProvider } from './sidebar/search-provider';
import { dispose as disposeScanner, scanContent } from './common/lib/scanner';
import { logger } from './common/utils/logger';
import { getChangedFiles, invalidateCache, getModifiedLineRanges } from './common/utils/git-helper';
import { getNewIssues } from './common/utils/issue-comparator';
import { registerAllCommands } from './commands';
import { loadEffectiveConfig } from './common/lib/config-manager';
import { StatusBarManager } from './status-bar/status-bar-manager';

let activationKey: string | undefined;

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const currentKey = workspaceFolder?.uri.fsPath || 'no-workspace';

  if (activationKey === currentKey) {
    logger.warn('Extension already activated for this workspace, skipping duplicate activation');
    return;
  }

  activationKey = currentKey;
  logger.info('Lino extension activated');

  const searchProvider = new SearchResultProvider();
  const viewModeKey = context.workspaceState.get<'list' | 'tree'>('lino.viewMode', 'list');
  const groupModeKey = context.workspaceState.get<'default' | 'rule'>('lino.groupMode', 'default');
  const scanModeKey = context.workspaceState.get<'workspace' | 'branch'>('lino.scanMode', 'workspace');
  const compareBranch = context.workspaceState.get<string>('lino.compareBranch', 'main');

  searchProvider.viewMode = viewModeKey;
  searchProvider.groupMode = groupModeKey;

  const cachedResults = context.workspaceState.get<any[]>('lino.cachedResults', []);
  const deserializedResults = cachedResults.map((r) => ({
    ...r,
    uri: vscode.Uri.parse(r.uriString),
  }));
  searchProvider.setResults(deserializedResults);

  vscode.commands.executeCommand('setContext', 'linoViewMode', viewModeKey);
  vscode.commands.executeCommand('setContext', 'linoGroupMode', groupModeKey);
  vscode.commands.executeCommand('setContext', 'linoScanMode', scanModeKey);

  const treeView = vscode.window.createTreeView('linoExplorer', {
    treeDataProvider: searchProvider,
  });

  const isSearchingRef = { current: false };
  const currentScanModeRef = { current: scanModeKey };
  const currentCompareBranchRef = { current: compareBranch };

  logger.info('Creating status bar manager...');
  const statusBarManager = new StatusBarManager(context, currentScanModeRef, currentCompareBranchRef);
  const updateStatusBar = async () => {
    await statusBarManager.update();
  };
  updateStatusBar();
  logger.info('Status bar setup complete');

  const updateBadge = () => {
    const count = searchProvider.getResultCount();
    treeView.badge = count > 0 ? { value: count, tooltip: `${count} issue${count === 1 ? '' : 's'}` } : undefined;
  };

  updateBadge();

  const commands = registerAllCommands({
    searchProvider,
    context,
    treeView,
    updateBadge,
    updateStatusBar,
    isSearchingRef,
    currentScanModeRef,
    currentCompareBranchRef,
  });

  const updateSingleFile = async (uri: vscode.Uri) => {
    if (isSearchingRef.current) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const relativePath = vscode.workspace.asRelativePath(uri);
    logger.debug(`File changed: ${relativePath}`);

    if (currentScanModeRef.current === 'branch') {
      invalidateCache();
      const changedFiles = await getChangedFiles(workspaceFolder.uri.fsPath, currentCompareBranchRef.current);
      if (!changedFiles.has(relativePath)) {
        logger.debug(`File not in changed files set, skipping: ${relativePath}`);
        return;
      }
    }

    try {
      logger.debug(`Scanning single file: ${relativePath}`);

      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      const config = await loadEffectiveConfig(context, workspaceFolder.uri.fsPath);
      let newResults = await scanContent(uri.fsPath, content, config);

      if (currentScanModeRef.current === 'branch') {
        const ranges = await getModifiedLineRanges(
          workspaceFolder.uri.fsPath,
          relativePath,
          currentCompareBranchRef.current,
        );
        const modifiedRanges = new Map();
        modifiedRanges.set(uri.fsPath, ranges);
        newResults = getNewIssues(newResults, modifiedRanges);
        logger.debug(`Filtered ${newResults.length} issues to modified lines only`);
      }

      const currentResults = searchProvider.getResults();
      const filteredResults = currentResults.filter((r) => {
        const resultPath = vscode.workspace.asRelativePath(r.uri);
        return resultPath !== relativePath;
      });

      const mergedResults = [...filteredResults, ...newResults];
      logger.debug(
        `Updated results: removed ${currentResults.length - filteredResults.length}, added ${newResults.length}, total ${mergedResults.length}`,
      );

      searchProvider.setResults(mergedResults);

      const serializedResults = mergedResults.map((r) => {
        const { uri, ...rest } = r;
        return {
          ...rest,
          uriString: uri.toString(),
        };
      });
      context.workspaceState.update('lino.cachedResults', serializedResults);
      updateBadge();
    } catch (error) {
      logger.error(`Failed to update single file: ${error}`);
    }
  };

  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');
  fileWatcher.onDidChange(updateSingleFile);
  fileWatcher.onDidCreate(updateSingleFile);
  fileWatcher.onDidDelete(async (uri) => {
    const relativePath = vscode.workspace.asRelativePath(uri);
    logger.debug(`File deleted: ${relativePath}`);

    if (currentScanModeRef.current === 'branch') {
      invalidateCache();
    }

    const currentResults = searchProvider.getResults();
    const filteredResults = currentResults.filter((r) => {
      const resultPath = vscode.workspace.asRelativePath(r.uri);
      return resultPath !== relativePath;
    });

    if (filteredResults.length !== currentResults.length) {
      logger.debug(`Removed ${currentResults.length - filteredResults.length} issues from deleted file`);
      searchProvider.setResults(filteredResults);

      const serializedResults = filteredResults.map((r) => {
        const { uri, ...rest } = r;
        return {
          ...rest,
          uriString: uri.toString(),
        };
      });
      context.workspaceState.update('lino.cachedResults', serializedResults);
      updateBadge();
    }
  });

  context.subscriptions.push(...commands, fileWatcher, statusBarManager.getDisposable());

  setTimeout(() => {
    logger.info('Running initial scan after 2s delay...');
    vscode.commands.executeCommand('lino.findIssue', { silent: true });
  }, 2000);
}

export function deactivate() {
  disposeScanner();
}
