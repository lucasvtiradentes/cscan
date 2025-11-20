import * as vscode from 'vscode';
import { z } from 'zod';
import { getCommandId, getContextKey } from '../constants';
import { CONTEXT_PREFIX } from '../scripts-constants';

export enum ViewMode {
  List = 'list',
  Tree = 'tree',
}

export enum GroupMode {
  Default = 'default',
  Rule = 'rule',
}

export enum ScanMode {
  Workspace = 'workspace',
  Branch = 'branch',
}

export enum WorkspaceStateKey {
  ViewMode = 'viewMode',
  GroupMode = 'groupMode',
  ScanMode = 'scanMode',
  CompareBranch = 'compareBranch',
  CachedResults = 'cachedResults',
}

const workspaceStateSchema = z.object({
  [WorkspaceStateKey.ViewMode]: z.enum(ViewMode),
  [WorkspaceStateKey.GroupMode]: z.enum(GroupMode),
  [WorkspaceStateKey.ScanMode]: z.enum(ScanMode),
  [WorkspaceStateKey.CompareBranch]: z.string(),
  [WorkspaceStateKey.CachedResults]: z.array(z.any()),
});

type WorkspaceStateSchema = z.infer<typeof workspaceStateSchema>;
type WorkspaceStateKeyType = keyof WorkspaceStateSchema;

const defaultValues: WorkspaceStateSchema = {
  [WorkspaceStateKey.ViewMode]: ViewMode.List,
  [WorkspaceStateKey.GroupMode]: GroupMode.Default,
  [WorkspaceStateKey.ScanMode]: ScanMode.Workspace,
  [WorkspaceStateKey.CompareBranch]: 'main',
  [WorkspaceStateKey.CachedResults]: [],
};

const keyMapping: Record<WorkspaceStateKeyType, string> = Object.fromEntries(
  Object.values(WorkspaceStateKey).map((key) => [key, `${CONTEXT_PREFIX}.${key}`]),
) as Record<WorkspaceStateKeyType, string>;

export enum ContextKey {
  ViewMode = 'cscannerViewMode',
  GroupMode = 'cscannerGroupMode',
  ScanMode = 'cscannerScanMode',
  Searching = 'cscannerSearching',
}

export enum Command {
  FindIssue = 'findIssue',
  ManageRules = 'manageRules',
  OpenSettingsMenu = 'openSettingsMenu',
  SetListView = 'setListView',
  SetTreeView = 'setTreeView',
  SetGroupByDefault = 'setGroupByDefault',
  SetGroupByRule = 'setGroupByRule',
  OpenFile = 'openFile',
  CopyPath = 'copyPath',
  CopyRelativePath = 'copyRelativePath',
  Refresh = 'refresh',
  HardScan = 'hardScan',
  GoToNextIssue = 'goToNextIssue',
  GoToPreviousIssue = 'goToPreviousIssue',
  ShowLogs = 'showLogs',
}

export enum TreeItemContextValue {
  RuleGroup = 'CscannerNodeRuleGroup',
  Folder = 'CscannerNodeFolder',
  File = 'CscannerNodeFile',
  Issue = 'CscannerNodeIssue',
}

const contextKeyMapping: Partial<Record<WorkspaceStateKeyType, ContextKey>> = {
  viewMode: ContextKey.ViewMode,
  groupMode: ContextKey.GroupMode,
  scanMode: ContextKey.ScanMode,
};

export function getWorkspaceState<K extends WorkspaceStateKeyType>(
  context: vscode.ExtensionContext,
  key: K,
): WorkspaceStateSchema[K] {
  const storageKey = keyMapping[key];
  const value = context.workspaceState.get(storageKey);
  const defaultValue = defaultValues[key];

  if (value === undefined) {
    return defaultValue;
  }

  const schema = workspaceStateSchema.shape[key];
  const result = schema.safeParse(value);

  return (result.success ? result.data : defaultValue) as WorkspaceStateSchema[K];
}

export function setWorkspaceState<K extends WorkspaceStateKeyType>(
  context: vscode.ExtensionContext,
  key: K,
  value: WorkspaceStateSchema[K],
): Thenable<void> {
  const storageKey = keyMapping[key];
  return context.workspaceState.update(storageKey, value);
}

export function setContextKey(key: ContextKey, value: unknown): Thenable<unknown> {
  return vscode.commands.executeCommand('setContext', getContextKey(key), value);
}

export function updateState<K extends WorkspaceStateKeyType>(
  context: vscode.ExtensionContext,
  key: K,
  value: WorkspaceStateSchema[K],
): void {
  setWorkspaceState(context, key, value);
  const contextKey = contextKeyMapping[key];
  if (contextKey) {
    setContextKey(contextKey, value);
  }
}

export function executeCommand(command: Command, ...args: any[]): Thenable<unknown> {
  return vscode.commands.executeCommand(getCommandId(command), ...args);
}

export function registerCommand(command: Command, callback: (...args: any[]) => any): vscode.Disposable {
  return vscode.commands.registerCommand(getCommandId(command), callback);
}

export enum ToastKind {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
}

export function showToastMessage(kind: ToastKind, message: string, ...items: string[]): Thenable<string | undefined> {
  switch (kind) {
    case ToastKind.Info:
      return vscode.window.showInformationMessage(message, ...items);
    case ToastKind.Warning:
      return vscode.window.showWarningMessage(message, ...items);
    case ToastKind.Error:
      return vscode.window.showErrorMessage(message, ...items);
  }
}

export function openTextDocument(uri: vscode.Uri): Thenable<vscode.TextDocument> {
  return vscode.workspace.openTextDocument(uri);
}

export function getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
  return vscode.workspace.workspaceFolders;
}

export function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}
