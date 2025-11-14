import * as vscode from 'vscode';
import { SearchResultProvider } from '../ui/searchProvider';
import { scanWorkspace } from '../lib/scanner';
import { getChangedFiles, getModifiedLineRanges } from '../utils/gitHelper';
import { getNewIssues } from '../utils/issueComparator';
import { logger } from '../utils/logger';

export function createFindIssueCommand(
  searchProvider: SearchResultProvider,
  context: vscode.ExtensionContext,
  treeView: vscode.TreeView<any>,
  updateBadge: () => void,
  isSearchingRef: { current: boolean },
  currentScanModeRef: { current: 'workspace' | 'branch' },
  currentCompareBranchRef: { current: string }
) {
  return vscode.commands.registerCommand('lino.findIssue', async () => {
    if (isSearchingRef.current) {
      vscode.window.showWarningMessage('Search already in progress');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    isSearchingRef.current = true;
    vscode.commands.executeCommand('setContext', 'linoSearching', true);
    treeView.badge = { value: 0, tooltip: 'Searching...' };

    const scanTitle = currentScanModeRef.current === 'branch'
      ? `Scanning issues (diff vs ${currentCompareBranchRef.current})`
      : 'Searching for issues';

    logger.info(`Starting scan in ${currentScanModeRef.current} mode`);

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: scanTitle,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0 });

        const startTime = Date.now();
        let results;

        if (currentScanModeRef.current === 'branch') {
          const gitDiffStart = Date.now();
          const changedFiles = await getChangedFiles(workspaceFolder.uri.fsPath, currentCompareBranchRef.current);
          const gitDiffTime = Date.now() - gitDiffStart;
          logger.debug(`Git diff completed in ${gitDiffTime}ms: ${changedFiles.size} files`);

          const scanCurrentStart = Date.now();
          const currentResults = await scanWorkspace(changedFiles);
          const scanCurrentTime = Date.now() - scanCurrentStart;
          logger.debug(`Current branch scan completed in ${scanCurrentTime}ms`);

          const filterStart = Date.now();
          const pathCache = new Map<string, string>();

          const currentFiltered = currentResults.filter(result => {
            const uriStr = result.uri.toString();
            let relativePath = pathCache.get(uriStr);

            if (!relativePath) {
              relativePath = vscode.workspace.asRelativePath(result.uri);
              pathCache.set(uriStr, relativePath);
            }

            return changedFiles.has(relativePath);
          });

          const filterTime = Date.now() - filterStart;
          logger.debug(`Filtered ${currentResults.length} → ${currentFiltered.length} issues in ${changedFiles.size} changed files (${filterTime}ms)`);

          const rangesStart = Date.now();
          const modifiedRanges = new Map<string, any>();

          for (const relPath of changedFiles) {
            const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, relPath).fsPath;
            const ranges = await getModifiedLineRanges(workspaceFolder.uri.fsPath, relPath, currentCompareBranchRef.current);
            modifiedRanges.set(fullPath, ranges);
          }

          const rangesTime = Date.now() - rangesStart;
          logger.debug(`Got modified line ranges in ${rangesTime}ms`);

          const compareStart = Date.now();
          results = getNewIssues(currentFiltered, modifiedRanges);
          const compareTime = Date.now() - compareStart;

          logger.info(`Branch comparison: ${currentFiltered.length} issues → ${results.length} in modified lines (${compareTime}ms)`);
        } else {
          results = await scanWorkspace();
        }

        const elapsed = Date.now() - startTime;
        logger.info(`Search completed in ${elapsed}ms, found ${results.length} results`);

        progress.report({ increment: 100 });

        searchProvider.setResults(results);

        const serializedResults = results.map(r => {
          const { uri, ...rest } = r;
          return {
            ...rest,
            uriString: uri.toString()
          };
        });
        context.workspaceState.update('lino.cachedResults', serializedResults);
        updateBadge();

        if (searchProvider.viewMode === 'tree') {
          setTimeout(() => {
            const folders = searchProvider.getAllFolderItems();
            folders.forEach(folder => {
              treeView.reveal(folder, { expand: true, select: false, focus: false });
            });
          }, 100);
        }

        if (results.length === 0) {
          vscode.window.showInformationMessage('No issues found!');
        } else {
          vscode.window.showInformationMessage(`Found ${results.length} issue${results.length === 1 ? '' : 's'}`);
        }
      });
    } finally {
      isSearchingRef.current = false;
      vscode.commands.executeCommand('setContext', 'linoSearching', false);
    }
  });
}
