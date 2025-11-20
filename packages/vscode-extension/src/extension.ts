import * as vscode from 'vscode';
import { registerAllCommands } from './commands';
import { getViewId } from './common/constants';
import { loadEffectiveConfig } from './common/lib/config-manager';
import { dispose as disposeScanner, scanContent } from './common/lib/scanner';
import {
  Command,
  ContextKey,
  WorkspaceStateKey,
  executeCommand,
  getCurrentWorkspaceFolder,
  getWorkspaceState,
  openTextDocument,
  setContextKey,
  setWorkspaceState,
} from './common/lib/vscode-utils';
import { getChangedFiles, getModifiedLineRanges, invalidateCache } from './common/utils/git-helper';
import { getNewIssues } from './common/utils/issue-comparator';
import { logger } from './common/utils/logger';
import { SearchResultProvider } from './sidebar/search-provider';
import { StatusBarManager } from './status-bar/status-bar-manager';

let activationKey: string | undefined;

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = getCurrentWorkspaceFolder();
  const currentKey = workspaceFolder?.uri.fsPath || 'no-workspace';

  if (activationKey === currentKey) {
    logger.warn('Extension already activated for this workspace, skipping duplicate activation');
    return;
  }

  activationKey = currentKey;
  logger.info('Cscanner extension activated');

  const searchProvider = new SearchResultProvider();
  const viewModeKey = getWorkspaceState(context, WorkspaceStateKey.ViewMode);
  const groupModeKey = getWorkspaceState(context, WorkspaceStateKey.GroupMode);
  const scanModeKey = getWorkspaceState(context, WorkspaceStateKey.ScanMode);
  const compareBranch = getWorkspaceState(context, WorkspaceStateKey.CompareBranch);

  searchProvider.viewMode = viewModeKey;
  searchProvider.groupMode = groupModeKey;

  const cachedResults = getWorkspaceState(context, WorkspaceStateKey.CachedResults);
  const deserializedResults = cachedResults.map((r) => ({
    ...r,
    uri: vscode.Uri.parse(r.uriString),
  }));
  searchProvider.setResults(deserializedResults);

  setContextKey(ContextKey.ViewMode, viewModeKey);
  setContextKey(ContextKey.GroupMode, groupModeKey);
  setContextKey(ContextKey.ScanMode, scanModeKey);

  const viewId = getViewId();
  logger.info(`Registering tree view with ID: ${viewId}`);

  const treeView = vscode.window.createTreeView(viewId, {
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

    const workspaceFolder = getCurrentWorkspaceFolder();
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

      const document = await openTextDocument(uri);
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
      setWorkspaceState(context, WorkspaceStateKey.CachedResults, serializedResults);
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
      setWorkspaceState(context, WorkspaceStateKey.CachedResults, serializedResults);
      updateBadge();
    }
  });

  context.subscriptions.push(...commands, fileWatcher, statusBarManager.getDisposable());

  setTimeout(() => {
    logger.info('Running initial scan after 2s delay...');
    executeCommand(Command.FindIssue, { silent: true });
  }, 2000);
}

export function deactivate() {
  disposeScanner();
}
