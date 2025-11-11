import * as vscode from 'vscode';
import { SearchResultProvider } from './searchProvider';
import { scanWorkspace, dispose as disposeScanner } from './issueScanner';
import { logger } from './logger';
import { getAllBranches, getChangedFiles, getCurrentBranch, invalidateCache } from './gitHelper';

export function activate(context: vscode.ExtensionContext) {
  logger.info('Lino extension activated');
  const searchProvider = new SearchResultProvider();
  const viewModeKey = context.workspaceState.get<'list' | 'tree'>('lino.viewMode', 'list');
  const groupModeKey = context.workspaceState.get<'default' | 'rule'>('lino.groupMode', 'default');
  const scanModeKey = context.workspaceState.get<'workspace' | 'branch'>('lino.scanMode', 'workspace');
  const compareBranch = context.workspaceState.get<string>('lino.compareBranch', 'main');

  searchProvider.viewMode = viewModeKey;
  searchProvider.groupMode = groupModeKey;

  const cachedResults = context.workspaceState.get<any[]>('lino.cachedResults', []);
  const deserializedResults = cachedResults.map(r => ({
    ...r,
    uri: vscode.Uri.parse(r.uriString)
  }));
  searchProvider.setResults(deserializedResults);

  vscode.commands.executeCommand('setContext', 'linoViewMode', viewModeKey);
  vscode.commands.executeCommand('setContext', 'linoGroupMode', groupModeKey);
  vscode.commands.executeCommand('setContext', 'linoScanMode', scanModeKey);

  const treeView = vscode.window.createTreeView('linoExplorer', {
    treeDataProvider: searchProvider
  });

  let isSearching = false;
  let currentScanMode = scanModeKey;
  let currentCompareBranch = compareBranch;

  logger.info('Creating status bar item...');
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  logger.info(`Status bar item created: ${statusBarItem ? 'YES' : 'NO'}`);

  const updateStatusBar = async () => {
    logger.debug('updateStatusBar called');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let hasConfig = false;

    if (workspaceFolder) {
      const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.lino', 'rules.json');
      try {
        await vscode.workspace.fs.stat(configPath);
        hasConfig = true;
      } catch {
        hasConfig = false;
      }
    }

    const icon = hasConfig ? '$(gear)' : '$(warning)';
    const modeText = currentScanMode === 'workspace' ? 'Codebase' : 'Branch';
    const branchText = currentScanMode === 'branch' ? ` (${currentCompareBranch})` : '';
    const configWarning = hasConfig ? '' : ' [No rules configured]';

    statusBarItem.text = `${icon} Lino: ${modeText}${branchText}${configWarning}`;
    statusBarItem.tooltip = hasConfig
      ? 'Click to change scan settings'
      : 'No rules configured. Click to set up rules.';

    logger.debug(`Status bar text set to: ${statusBarItem.text}`);
    statusBarItem.show();
    logger.info('Status bar item show() called');
  };

  const openSettingsMenuCommand = vscode.commands.registerCommand('lino.openSettingsMenu', async () => {
    logger.info('openSettingsMenu command called');
    const mainMenuItems: vscode.QuickPickItem[] = [
      {
        label: '$(checklist) Manage Default Rules',
        detail: 'Enable/disable built-in rules and generate configuration'
      },
      {
        label: '$(gear) Manage Scan Settings',
        detail: 'Choose between Codebase or Branch scan mode'
      }
    ];

    const selected = await vscode.window.showQuickPick(mainMenuItems, {
      placeHolder: 'Lino Settings',
      ignoreFocusOut: false
    });

    if (!selected) return;

    if (selected.label.includes('Manage Default Rules')) {
      await vscode.commands.executeCommand('lino.manageRules');
      return;
    }

    if (selected.label.includes('Manage Scan Settings')) {
      await showScanSettingsMenu();
      return;
    }
  });

  async function showScanSettingsMenu() {
    const scanModeItems: vscode.QuickPickItem[] = [
      {
        label: '$(file-directory) Codebase',
        description: currentScanMode === 'workspace' ? '✓ Active' : '',
        detail: 'Scan all files in workspace'
      },
      {
        label: '$(git-branch) Branch',
        description: currentScanMode === 'branch' ? '✓ Active' : '',
        detail: 'Scan only changed files in current branch'
      }
    ];

    const selected = await vscode.window.showQuickPick(scanModeItems, {
      placeHolder: 'Change checking mode',
      ignoreFocusOut: false
    });

    if (!selected) return;

    if (selected.label.includes('Codebase')) {
      currentScanMode = 'workspace';
      context.workspaceState.update('lino.scanMode', 'workspace');
      vscode.commands.executeCommand('setContext', 'linoScanMode', 'workspace');
      invalidateCache();
      updateStatusBar();
      vscode.commands.executeCommand('lino.findIssue');
    } else if (selected.label.includes('Branch')) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const currentBranch = await getCurrentBranch(workspaceFolder.uri.fsPath);
      if (!currentBranch) {
        vscode.window.showErrorMessage('Not in a git repository');
        return;
      }

      const branchOptions: vscode.QuickPickItem[] = [
        {
          label: `Current value: ${currentCompareBranch}`,
          description: '✓',
          detail: 'Currently comparing against this branch'
        },
        {
          label: '$(list-selection) Choose another branch',
          detail: 'Select a different branch to compare against'
        }
      ];

      const branchSelected = await vscode.window.showQuickPick(branchOptions, {
        placeHolder: 'Branch settings',
        ignoreFocusOut: false
      });

      if (!branchSelected) return;

      if (branchSelected.label.includes('Choose another branch')) {
        const branches = await getAllBranches(workspaceFolder.uri.fsPath);

        if (branches.length === 0) {
          vscode.window.showErrorMessage('No branches found');
          return;
        }

        const otherBranches = branches.filter(b => b !== currentBranch);

        const localBranches = otherBranches.filter(b => !b.startsWith('origin/'));
        const remoteBranches = otherBranches.filter(b => b.startsWith('origin/'));

        const branchItems: vscode.QuickPickItem[] = [];

        if (localBranches.length > 0) {
          branchItems.push(
            { label: 'Branches', kind: vscode.QuickPickItemKind.Separator },
            ...localBranches.map(branch => ({
              label: `$(git-branch) ${branch}`,
              description: branch === currentCompareBranch ? '$(check) Current compare target' : '',
              detail: branch
            }))
          );
        }

        if (remoteBranches.length > 0) {
          branchItems.push(
            { label: 'Remote branches', kind: vscode.QuickPickItemKind.Separator },
            ...remoteBranches.map(branch => ({
              label: `$(cloud) ${branch}`,
              description: branch === currentCompareBranch ? '$(check) Current compare target' : '',
              detail: branch
            }))
          );
        }

        const selectedBranch = await vscode.window.showQuickPick(branchItems, {
          placeHolder: `Select branch to compare against (current: ${currentBranch})`,
          matchOnDescription: true,
          matchOnDetail: true,
          ignoreFocusOut: true
        });

        if (!selectedBranch || !selectedBranch.detail) return;

        currentCompareBranch = selectedBranch.detail;
        context.workspaceState.update('lino.compareBranch', currentCompareBranch);
      }

      currentScanMode = 'branch';
      context.workspaceState.update('lino.scanMode', 'branch');
      vscode.commands.executeCommand('setContext', 'linoScanMode', 'branch');
      invalidateCache();
      updateStatusBar();
      vscode.commands.executeCommand('lino.findIssue');
    }
  }

  const manageRulesCommand = vscode.commands.registerCommand('lino.manageRules', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const { RustClient } = await import('./rustClient');
    const { getRustBinaryPath } = await import('./issueScanner');

    const binaryPath = getRustBinaryPath();
    if (!binaryPath) {
      vscode.window.showErrorMessage('Lino: Rust binary not found. Please build the Rust core first.');
      return;
    }

    const client = new RustClient(binaryPath);
    await client.start();

    try {
      const rules = await client.getRulesMetadata();

      const configDir = vscode.Uri.joinPath(workspaceFolder.uri, '.lino');
      const configPath = vscode.Uri.joinPath(configDir, 'rules.json');
      let existingConfig: any = null;

      try {
        const configData = await vscode.workspace.fs.readFile(configPath);
        existingConfig = JSON.parse(Buffer.from(configData).toString('utf8'));
      } catch {
        existingConfig = null;
      }

      interface RuleQuickPickItem extends vscode.QuickPickItem {
        ruleName: string;
        picked: boolean;
        isCustom: boolean;
      }

      const builtinRuleNames = new Set(rules.map(r => r.name));
      const customRules: RuleQuickPickItem[] = [];
      const defaultRules: RuleQuickPickItem[] = [];

      if (existingConfig?.rules) {
        for (const [ruleName, ruleConfig] of Object.entries(existingConfig.rules)) {
          if (!builtinRuleNames.has(ruleName) && (ruleConfig as any).pattern) {
            customRules.push({
              label: `$(regex) ${ruleName}`,
              description: `[REGEX] custom`,
              detail: (ruleConfig as any).message || (ruleConfig as any).pattern,
              ruleName,
              picked: (ruleConfig as any).enabled ?? true,
              isCustom: true
            });
          }
        }
      }

      for (const rule of rules) {
        const existingRule = existingConfig?.rules?.[rule.name];
        const isEnabled = existingRule?.enabled ?? false;

        defaultRules.push({
          label: `$(${rule.category === 'typesafety' ? 'shield' : rule.category === 'codequality' ? 'beaker' : 'symbol-color'}) ${rule.displayName}`,
          description: `[${rule.ruleType.toUpperCase()}] ${rule.defaultSeverity}`,
          detail: rule.description,
          ruleName: rule.name,
          picked: isEnabled,
          isCustom: false
        });
      }

      const items: RuleQuickPickItem[] = [
        ...(customRules.length > 0 ? [
          { label: 'Custom Rules', kind: vscode.QuickPickItemKind.Separator } as any,
          ...customRules
        ] : []),
        { label: 'Default Rules', kind: vscode.QuickPickItemKind.Separator } as any,
        ...defaultRules
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select rules to enable (Space to toggle, Enter to confirm)',
        canPickMany: true,
        ignoreFocusOut: true
      });

      if (!selected) {
        await client.stop();
        return;
      }

      const enabledRules = new Set(
        selected
          .filter((item): item is RuleQuickPickItem => 'ruleName' in item)
          .map(item => item.ruleName)
      );

      const config: any = existingConfig || {
        rules: {},
        include: ['**/*.ts', '**/*.tsx'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
      };

      if (!config.rules) {
        config.rules = {};
      }

      for (const rule of rules) {
        const existingRule = config.rules[rule.name];

        if (enabledRules.has(rule.name)) {
          config.rules[rule.name] = existingRule || {
            enabled: true,
            type: rule.ruleType,
            severity: rule.defaultSeverity,
            message: null,
            include: [],
            exclude: []
          };
          config.rules[rule.name].enabled = true;
        } else {
          if (existingRule) {
            existingRule.enabled = false;
          }
        }
      }

      await vscode.workspace.fs.createDirectory(configDir);
      await vscode.workspace.fs.writeFile(
        configPath,
        Buffer.from(JSON.stringify(config, null, 2))
      );

      await client.stop();

      await updateStatusBar();

      await vscode.commands.executeCommand('lino.findIssue');
    } catch (error) {
      logger.error(`Failed to manage rules: ${error}`);
      await client.stop();
      vscode.window.showErrorMessage(`Failed to load rules: ${error}`);
    }
  });

  logger.info('Setting status bar command...');
  statusBarItem.command = 'lino.openSettingsMenu';
  logger.info('Calling updateStatusBar for first time...');
  updateStatusBar();
  logger.info('Status bar setup complete');

  const updateBadge = () => {
    const count = searchProvider.getResultCount();
    treeView.badge = count > 0 ? { value: count, tooltip: `${count} issue${count === 1 ? '' : 's'}` } : undefined;
  };

  updateBadge();

  const findIssueCommand = vscode.commands.registerCommand('lino.findIssue', async () => {
    if (isSearching) {
      vscode.window.showWarningMessage('Search already in progress');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    isSearching = true;
    vscode.commands.executeCommand('setContext', 'linoSearching', true);
    treeView.badge = { value: 0, tooltip: 'Searching...' };

    const scanTitle = currentScanMode === 'branch'
      ? `Scanning issues (diff vs ${currentCompareBranch})`
      : 'Searching for issues';

    logger.info(`Starting scan in ${currentScanMode} mode`);

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: scanTitle,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0 });

        const startTime = Date.now();
        let results;

        if (currentScanMode === 'branch') {
          const gitDiffStart = Date.now();
          const changedFiles = await getChangedFiles(workspaceFolder.uri.fsPath, currentCompareBranch);
          const gitDiffTime = Date.now() - gitDiffStart;
          logger.debug(`Git diff completed in ${gitDiffTime}ms: ${changedFiles.size} files`);

          const scanStart = Date.now();
          const scanResults = await scanWorkspace(changedFiles);
          const scanTime = Date.now() - scanStart;
          logger.debug(`Workspace scan completed in ${scanTime}ms`);

          const filterStart = Date.now();
          const pathCache = new Map<string, string>();

          results = scanResults.filter(result => {
            const uriStr = result.uri.toString();
            let relativePath = pathCache.get(uriStr);

            if (!relativePath) {
              relativePath = vscode.workspace.asRelativePath(result.uri);
              pathCache.set(uriStr, relativePath);
            }

            return changedFiles.has(relativePath);
          });

          const filterTime = Date.now() - filterStart;
          logger.info(`Filtered ${scanResults.length} → ${results.length} issues in ${changedFiles.size} changed files (${filterTime}ms)`);
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
    await vscode.commands.executeCommand('lino.findIssue');
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

  const updateSingleFile = async (uri: vscode.Uri) => {
    if (isSearching) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const relativePath = vscode.workspace.asRelativePath(uri);
    logger.debug(`File changed: ${relativePath}`);

    if (currentScanMode === 'branch') {
      invalidateCache();
      const changedFiles = await getChangedFiles(workspaceFolder.uri.fsPath, currentCompareBranch);
      if (!changedFiles.has(relativePath)) {
        logger.debug(`File not in changed files set, skipping: ${relativePath}`);
        return;
      }
    }

    try {
      logger.debug(`Scanning single file: ${relativePath}`);
      const newResults = await rustClient.scanFile(workspaceFolder.uri.fsPath, uri.fsPath);

      const currentResults = searchProvider.getResults();
      const filteredResults = currentResults.filter(r => {
        const resultPath = vscode.workspace.asRelativePath(r.uri);
        return resultPath !== relativePath;
      });

      const mergedResults = [...filteredResults, ...newResults];
      logger.debug(`Updated results: removed ${currentResults.length - filteredResults.length}, added ${newResults.length}, total ${mergedResults.length}`);

      searchProvider.setResults(mergedResults);

      const serializedResults = mergedResults.map(r => {
        const { uri, ...rest} = r;
        return {
          ...rest,
          uriString: uri.toString()
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

    if (currentScanMode === 'branch') {
      invalidateCache();
    }

    const currentResults = searchProvider.getResults();
    const filteredResults = currentResults.filter(r => {
      const resultPath = vscode.workspace.asRelativePath(r.uri);
      return resultPath !== relativePath;
    });

    if (filteredResults.length !== currentResults.length) {
      logger.debug(`Removed ${currentResults.length - filteredResults.length} issues from deleted file`);
      searchProvider.setResults(filteredResults);

      const serializedResults = filteredResults.map(r => {
        const { uri, ...rest } = r;
        return {
          ...rest,
          uriString: uri.toString()
        };
      });
      context.workspaceState.update('lino.cachedResults', serializedResults);
      updateBadge();
    }
  });


  context.subscriptions.push(
    findIssueCommand,
    openFileCommand,
    setListViewCommand,
    setTreeViewCommand,
    refreshCommand,
    setGroupByDefaultCommand,
    setGroupByRuleCommand,
    copyPathCommand,
    copyRelativePathCommand,
    openSettingsMenuCommand,
    manageRulesCommand,
    fileWatcher,
    statusBarItem
  );

  setTimeout(() => {
    logger.info('Running initial scan after 2s delay...');
    vscode.commands.executeCommand('lino.findIssue');
  }, 2000);
}

export function deactivate() {
  disposeScanner();
}
