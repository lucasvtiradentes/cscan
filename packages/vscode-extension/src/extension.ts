import * as vscode from 'vscode';
import { SearchResultProvider } from './searchProvider';
import { scanWorkspace, dispose as disposeScanner } from './issueScanner';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
  logger.info('Lino extension activated');
  const searchProvider = new SearchResultProvider();
  const viewModeKey = context.workspaceState.get<'list' | 'tree'>('lino.viewMode', 'list');
  const groupModeKey = context.workspaceState.get<'default' | 'rule'>('lino.groupMode', 'default');
  searchProvider.viewMode = viewModeKey;
  searchProvider.groupMode = groupModeKey;

  const cachedResults = context.workspaceState.get<any[]>('lino.cachedResults', []);
  const deserializedResults = cachedResults.map(r => ({
    ...r,
    uri: vscode.Uri.parse(r.uriString)
  }));
  searchProvider.setResults(deserializedResults);

  const viewModeContextKey = vscode.commands.executeCommand('setContext', 'linoViewMode', viewModeKey);
  const groupModeContextKey = vscode.commands.executeCommand('setContext', 'linoGroupMode', groupModeKey);

  const treeView = vscode.window.createTreeView('linoExplorer', {
    treeDataProvider: searchProvider
  });

  const updateBadge = () => {
    const count = searchProvider.getResultCount();
    treeView.badge = count > 0 ? { value: count, tooltip: `${count} issue${count === 1 ? '' : 's'}` } : undefined;
  };

  updateBadge();

  let isSearching = false;

  const findAnyCommand = vscode.commands.registerCommand('lino.findAny', async () => {
    if (isSearching) {
      vscode.window.showWarningMessage('Search already in progress');
      return;
    }

    isSearching = true;
    vscode.commands.executeCommand('setContext', 'linoSearching', true);
    treeView.badge = { value: 0, tooltip: 'Searching...' };

    logger.info('Starting "any" type search');

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Searching for "any" types',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0 });

        const startTime = Date.now();
        const results = await scanWorkspace();
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
          vscode.window.showInformationMessage('No "any" types found!');
        } else {
          vscode.window.showInformationMessage(`Found ${results.length} "any" type${results.length === 1 ? '' : 's'}`);
        }
      });
    } finally {
      isSearching = false;
      vscode.commands.executeCommand('setContext', 'linoSearching', false);
    }
  });

  const openFileCommand = vscode.commands.registerCommand(
    'lino.openFile',
    (uri: vscode.Uri, line: number, column: number) => {
      vscode.workspace.openTextDocument(uri).then(doc => {
        vscode.window.showTextDocument(doc).then(editor => {
          const position = new vscode.Position(line, column);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
          );
        });
      });
    }
  );

  const setListViewCommand = vscode.commands.registerCommand('lino.setListView', () => {
    searchProvider.viewMode = 'list';
    context.workspaceState.update('lino.viewMode', 'list');
    vscode.commands.executeCommand('setContext', 'linoViewMode', 'list');
  });

  const setTreeViewCommand = vscode.commands.registerCommand('lino.setTreeView', () => {
    searchProvider.viewMode = 'tree';
    context.workspaceState.update('lino.viewMode', 'tree');
    vscode.commands.executeCommand('setContext', 'linoViewMode', 'tree');
  });

  const refreshCommand = vscode.commands.registerCommand('lino.refresh', async () => {
    await vscode.commands.executeCommand('lino.findAny');
  });

  const setGroupByDefaultCommand = vscode.commands.registerCommand('lino.setGroupByDefault', () => {
    searchProvider.groupMode = 'default';
    context.workspaceState.update('lino.groupMode', 'default');
    vscode.commands.executeCommand('setContext', 'linoGroupMode', 'default');
  });

  const setGroupByRuleCommand = vscode.commands.registerCommand('lino.setGroupByRule', () => {
    searchProvider.groupMode = 'rule';
    context.workspaceState.update('lino.groupMode', 'rule');
    vscode.commands.executeCommand('setContext', 'linoGroupMode', 'rule');
  });

  const copyPathCommand = vscode.commands.registerCommand('lino.copyPath', (item: any) => {
    if (item && item.resourceUri) {
      vscode.env.clipboard.writeText(item.resourceUri.fsPath);
      vscode.window.showInformationMessage(`Copied: ${item.resourceUri.fsPath}`);
    }
  });

  const copyRelativePathCommand = vscode.commands.registerCommand('lino.copyRelativePath', (item: any) => {
    if (item && item.resourceUri) {
      const relativePath = vscode.workspace.asRelativePath(item.resourceUri);
      vscode.env.clipboard.writeText(relativePath);
      vscode.window.showInformationMessage(`Copied: ${relativePath}`);
    }
  });

  context.subscriptions.push(
    findAnyCommand,
    openFileCommand,
    setListViewCommand,
    setTreeViewCommand,
    refreshCommand,
    setGroupByDefaultCommand,
    setGroupByRuleCommand,
    copyPathCommand,
    copyRelativePathCommand
  );
}

export function deactivate() {
  disposeScanner();
}
