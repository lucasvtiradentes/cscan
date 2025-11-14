import * as vscode from 'vscode';
import { SearchResultProvider } from '../ui/searchProvider';
import { createFindIssueCommand } from './findIssue';
import { createManageRulesCommand } from './manageRules';
import { createOpenSettingsMenuCommand } from './settings';
import {
  createSetListViewCommand,
  createSetTreeViewCommand,
  createSetGroupByDefaultCommand,
  createSetGroupByRuleCommand
} from './viewMode';
import {
  createOpenFileCommand,
  createCopyPathCommand,
  createCopyRelativePathCommand
} from './navigation';
import {
  createRefreshCommand,
  createHardScanCommand
} from './scan';

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
      ctx.isSearchingRef,
      ctx.currentScanModeRef,
      ctx.currentCompareBranchRef
    ),
    createManageRulesCommand(ctx.updateStatusBar),
    createOpenSettingsMenuCommand(
      ctx.updateStatusBar,
      ctx.currentScanModeRef,
      ctx.currentCompareBranchRef,
      ctx.context
    ),
    createSetListViewCommand(ctx.searchProvider, ctx.context),
    createSetTreeViewCommand(ctx.searchProvider, ctx.context),
    createSetGroupByDefaultCommand(ctx.searchProvider, ctx.context),
    createSetGroupByRuleCommand(ctx.searchProvider, ctx.context),
    createOpenFileCommand(),
    createCopyPathCommand(),
    createCopyRelativePathCommand(),
    createRefreshCommand(),
    createHardScanCommand(ctx.isSearchingRef)
  ];
}
