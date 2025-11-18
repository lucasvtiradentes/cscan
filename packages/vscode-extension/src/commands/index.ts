import * as vscode from 'vscode';
import { SearchResultProvider } from '../sidebar/search-provider';
import { createFindIssueCommand } from './find-issue';
import { createGoToNextIssueCommand, createGoToPreviousIssueCommand, resetIssueIndex } from './issue-navigation';
import { createManageRulesCommand } from './manage-rules';
import { createCopyPathCommand, createCopyRelativePathCommand, createOpenFileCommand } from './navigation';
import { createHardScanCommand, createRefreshCommand } from './scan';
import { createOpenSettingsMenuCommand } from './settings';
import { createShowLogsCommand } from './show-logs';
import {
  createSetGroupByDefaultCommand,
  createSetGroupByRuleCommand,
  createSetListViewCommand,
  createSetTreeViewCommand,
} from './view-mode';

export interface CommandContext {
  searchProvider: SearchResultProvider;
  context: vscode.ExtensionContext;
  treeView: vscode.TreeView<any>;
  updateBadge: () => void;
  updateStatusBar: () => Promise<void>;
  isSearchingRef: { current: boolean };
  currentScanModeRef: { current: 'workspace' | 'branch' };
  currentCompareBranchRef: { current: string };
}

export function registerAllCommands(ctx: CommandContext): vscode.Disposable[] {
  return [
    createFindIssueCommand(
      ctx.searchProvider,
      ctx.context,
      ctx.treeView,
      ctx.updateBadge,
      ctx.updateStatusBar,
      ctx.isSearchingRef,
      ctx.currentScanModeRef,
      ctx.currentCompareBranchRef,
    ),
    createManageRulesCommand(ctx.updateStatusBar, ctx.context),
    createOpenSettingsMenuCommand(
      ctx.updateStatusBar,
      ctx.currentScanModeRef,
      ctx.currentCompareBranchRef,
      ctx.context,
      ctx.searchProvider,
    ),
    createSetListViewCommand(ctx.searchProvider, ctx.context),
    createSetTreeViewCommand(ctx.searchProvider, ctx.context),
    createSetGroupByDefaultCommand(ctx.searchProvider, ctx.context),
    createSetGroupByRuleCommand(ctx.searchProvider, ctx.context),
    createOpenFileCommand(),
    createCopyPathCommand(),
    createCopyRelativePathCommand(),
    createRefreshCommand(),
    createHardScanCommand(ctx.isSearchingRef),
    createGoToNextIssueCommand(ctx.searchProvider),
    createGoToPreviousIssueCommand(ctx.searchProvider),
    createShowLogsCommand(),
  ];
}

export { resetIssueIndex };
