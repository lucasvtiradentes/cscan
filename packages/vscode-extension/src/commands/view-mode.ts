import * as vscode from 'vscode';
import { SearchResultProvider } from '../sidebar/search-provider';

export function createSetListViewCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand('lino.setListView', () => {
    searchProvider.viewMode = 'list';
    context.workspaceState.update('lino.viewMode', 'list');
    vscode.commands.executeCommand('setContext', 'linoViewMode', 'list');
  });
}

export function createSetTreeViewCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand('lino.setTreeView', () => {
    searchProvider.viewMode = 'tree';
    context.workspaceState.update('lino.viewMode', 'tree');
    vscode.commands.executeCommand('setContext', 'linoViewMode', 'tree');
  });
}

export function createSetGroupByDefaultCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand('lino.setGroupByDefault', () => {
    searchProvider.groupMode = 'default';
    context.workspaceState.update('lino.groupMode', 'default');
    vscode.commands.executeCommand('setContext', 'linoGroupMode', 'default');
  });
}

export function createSetGroupByRuleCommand(searchProvider: SearchResultProvider, context: vscode.ExtensionContext) {
  return vscode.commands.registerCommand('lino.setGroupByRule', () => {
    searchProvider.groupMode = 'rule';
    context.workspaceState.update('lino.groupMode', 'rule');
    vscode.commands.executeCommand('setContext', 'linoGroupMode', 'rule');
  });
}
