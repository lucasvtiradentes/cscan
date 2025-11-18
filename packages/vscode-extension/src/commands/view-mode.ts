import * as vscode from 'vscode';
import { getCommandId, getContextKey } from '../common/constants';
import { SearchResultProvider } from '../sidebar/search-provider';

export function createSetListViewCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand(getCommandId('setListView'), () => {
    searchProvider.viewMode = 'list';
    context.workspaceState.update('cscanner.viewMode', 'list');
    vscode.commands.executeCommand('setContext', getContextKey('cscanViewMode'), 'list');
  });
}

export function createSetTreeViewCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand(getCommandId('setTreeView'), () => {
    searchProvider.viewMode = 'tree';
    context.workspaceState.update('cscanner.viewMode', 'tree');
    vscode.commands.executeCommand('setContext', getContextKey('cscanViewMode'), 'tree');
  });
}

export function createSetGroupByDefaultCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand(getCommandId('setGroupByDefault'), () => {
    searchProvider.groupMode = 'default';
    context.workspaceState.update('cscanner.groupMode', 'default');
    vscode.commands.executeCommand('setContext', getContextKey('cscanGroupMode'), 'default');
  });
}

export function createSetGroupByRuleCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand(getCommandId('setGroupByRule'), () => {
    searchProvider.groupMode = 'rule';
    context.workspaceState.update('cscanner.groupMode', 'rule');
    vscode.commands.executeCommand('setContext', getContextKey('cscanGroupMode'), 'rule');
  });
}
