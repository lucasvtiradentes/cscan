import * as vscode from 'vscode';
import { hasLocalConfig, loadEffectiveConfig } from '../common/lib/config-manager';
import { scanWorkspace } from '../common/lib/scanner';
import {
  Command,
  ContextKey,
  ScanMode,
  ToastKind,
  ViewMode,
  WorkspaceStateKey,
  executeCommand,
  getCurrentWorkspaceFolder,
  registerCommand,
  setContextKey,
  setWorkspaceState,
  showToastMessage,
  updateState,
} from '../common/lib/vscode-utils';
import { branchExists, getChangedFiles, getModifiedLineRanges } from '../common/utils/git-helper';
import { getNewIssues } from '../common/utils/issue-comparator';
import { logger } from '../common/utils/logger';
import { SearchResultProvider } from '../sidebar/search-provider';
import { resetIssueIndex } from './issue-navigation';

export function createFindIssueCommand(
  searchProvider: SearchResultProvider,
  context: vscode.ExtensionContext,
  treeView: vscode.TreeView<any>,
  updateBadge: () => void,
  updateStatusBar: () => Promise<void>,
  isSearchingRef: { current: boolean },
  currentScanModeRef: { current: ScanMode },
  currentCompareBranchRef: { current: string },
) {
  return registerCommand(Command.FindIssue, async (options?: { silent?: boolean }) => {
    if (isSearchingRef.current) {
      if (!options?.silent) {
        showToastMessage(ToastKind.Warning, 'Search already in progress');
      }
      return;
    }

    const workspaceFolder = getCurrentWorkspaceFolder();
    if (!workspaceFolder) {
      if (!options?.silent) {
        showToastMessage(ToastKind.Error, 'No workspace folder open');
      }
      return;
    }

    const effectiveConfig = await loadEffectiveConfig(context, workspaceFolder.uri.fsPath);
    const hasLocal = await hasLocalConfig(workspaceFolder.uri.fsPath);

    if (!effectiveConfig || Object.keys(effectiveConfig.rules).length === 0) {
      if (!options?.silent) {
        const action = await showToastMessage(
          ToastKind.Warning,
          'No rules configured for this workspace',
          'Configure Rules',
        );
        if (action === 'Configure Rules') {
          await executeCommand(Command.ManageRules);
        }
      }
      return;
    }

    const configToPass = hasLocal ? undefined : effectiveConfig;
    if (hasLocal) {
      logger.info('Using local config from .cscanner/rules.json');
    } else {
      logger.info('Using global config from extension storage');
    }

    if (currentScanModeRef.current === ScanMode.Branch) {
      const branchExistsCheck = await branchExists(workspaceFolder.uri.fsPath, currentCompareBranchRef.current);
      if (!branchExistsCheck) {
        const action = await showToastMessage(
          ToastKind.Error,
          `Branch '${currentCompareBranchRef.current}' does not exist in this repository`,
          'Change Branch',
          'Switch to Workspace Mode',
        );

        if (action === 'Change Branch') {
          await executeCommand(Command.OpenSettingsMenu);
        } else if (action === 'Switch to Workspace Mode') {
          currentScanModeRef.current = ScanMode.Workspace;
          updateState(context, WorkspaceStateKey.ScanMode, ScanMode.Workspace);
          await updateStatusBar();
          await executeCommand(Command.FindIssue, { silent: true });
        }
        return;
      }
    }

    isSearchingRef.current = true;
    setContextKey(ContextKey.Searching, true);
    treeView.badge = { value: 0, tooltip: 'Searching...' };

    const scanTitle =
      currentScanModeRef.current === ScanMode.Branch
        ? `Scanning issues (diff vs ${currentCompareBranchRef.current})`
        : 'Searching for issues';

    logger.info(`Starting scan in ${currentScanModeRef.current} mode`);

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: scanTitle,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ increment: 0 });

          const startTime = Date.now();
          let results;

          if (currentScanModeRef.current === ScanMode.Branch) {
            const gitDiffStart = Date.now();
            const changedFiles = await getChangedFiles(workspaceFolder.uri.fsPath, currentCompareBranchRef.current);
            const gitDiffTime = Date.now() - gitDiffStart;
            logger.debug(`Git diff completed in ${gitDiffTime}ms: ${changedFiles.size} files`);

            const scanCurrentStart = Date.now();
            const currentResults = await scanWorkspace(changedFiles, configToPass);
            const scanCurrentTime = Date.now() - scanCurrentStart;
            logger.debug(`Current branch scan completed in ${scanCurrentTime}ms`);

            const filterStart = Date.now();
            const pathCache = new Map<string, string>();

            const currentFiltered = currentResults.filter((result) => {
              const uriStr = result.uri.toString();
              let relativePath = pathCache.get(uriStr);

              if (!relativePath) {
                relativePath = vscode.workspace.asRelativePath(result.uri);
                pathCache.set(uriStr, relativePath);
              }

              return changedFiles.has(relativePath);
            });

            const filterTime = Date.now() - filterStart;
            logger.debug(
              `Filtered ${currentResults.length} → ${currentFiltered.length} issues in ${changedFiles.size} changed files (${filterTime}ms)`,
            );

            const rangesStart = Date.now();
            const modifiedRanges = new Map<string, any>();

            for (const relPath of changedFiles) {
              const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, relPath).fsPath;
              const ranges = await getModifiedLineRanges(
                workspaceFolder.uri.fsPath,
                relPath,
                currentCompareBranchRef.current,
              );
              modifiedRanges.set(fullPath, ranges);
            }

            const rangesTime = Date.now() - rangesStart;
            logger.debug(`Got modified line ranges in ${rangesTime}ms`);

            const compareStart = Date.now();
            results = getNewIssues(currentFiltered, modifiedRanges);
            const compareTime = Date.now() - compareStart;

            logger.info(
              `Branch comparison: ${currentFiltered.length} issues → ${results.length} in modified lines (${compareTime}ms)`,
            );
          } else {
            results = await scanWorkspace(undefined, configToPass);
          }

          const elapsed = Date.now() - startTime;
          logger.info(`Search completed in ${elapsed}ms, found ${results.length} results`);

          progress.report({ increment: 100 });

          resetIssueIndex();
          searchProvider.setResults(results);

          const serializedResults = results.map((r) => {
            const { uri, ...rest } = r;
            return {
              ...rest,
              uriString: uri.toString(),
            };
          });
          setWorkspaceState(context, WorkspaceStateKey.CachedResults, serializedResults);
          updateBadge();

          if (searchProvider.viewMode === ViewMode.Tree) {
            setTimeout(() => {
              const folders = searchProvider.getAllFolderItems();
              folders.forEach((folder) => {
                treeView.reveal(folder, { expand: true, select: false, focus: false });
              });
            }, 100);
          }

          if (results.length === 0) {
            showToastMessage(ToastKind.Info, 'No issues found!');
          } else {
            showToastMessage(ToastKind.Info, `Found ${results.length} issue${results.length === 1 ? '' : 's'}`);
          }
        },
      );
    } finally {
      isSearchingRef.current = false;
      setContextKey(ContextKey.Searching, false);
    }
  });
}
