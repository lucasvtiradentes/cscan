import * as vscode from 'vscode';
import {
  Command,
  GroupMode,
  ViewMode,
  WorkspaceStateKey,
  registerCommand,
  updateState,
} from '../common/lib/vscode-utils';
import { SearchResultProvider } from '../sidebar/search-provider';

export function createSetListViewCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return registerCommand(Command.SetListView, () => {
    searchProvider.viewMode = ViewMode.List;
    updateState(context, WorkspaceStateKey.ViewMode, ViewMode.List);
  });
}

export function createSetTreeViewCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return registerCommand(Command.SetTreeView, () => {
    searchProvider.viewMode = ViewMode.Tree;
    updateState(context, WorkspaceStateKey.ViewMode, ViewMode.Tree);
  });
}

export function createSetGroupByDefaultCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return registerCommand(Command.SetGroupByDefault, () => {
    searchProvider.groupMode = GroupMode.Default;
    updateState(context, WorkspaceStateKey.GroupMode, GroupMode.Default);
  });
}

export function createSetGroupByRuleCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return registerCommand(Command.SetGroupByRule, () => {
    searchProvider.groupMode = GroupMode.Rule;
    updateState(context, WorkspaceStateKey.GroupMode, GroupMode.Rule);
  });
}
