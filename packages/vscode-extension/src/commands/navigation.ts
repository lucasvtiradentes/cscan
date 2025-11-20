import * as vscode from 'vscode';
import { Command, ToastKind, openTextDocument, registerCommand, showToastMessage } from '../common/lib/vscode-utils';

export function createOpenFileCommand() {
  return registerCommand(Command.OpenFile, (uri: vscode.Uri, line: number, column: number) => {
    openTextDocument(uri).then((doc) => {
      vscode.window.showTextDocument(doc).then((editor) => {
        const position = new vscode.Position(line, column);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      });
    });
  });
}

export function createCopyPathCommand() {
  return registerCommand(Command.CopyPath, (item) => {
    if (item && item.resourceUri) {
      vscode.env.clipboard.writeText(item.resourceUri.fsPath);
      showToastMessage(ToastKind.Info, `Copied: ${item.resourceUri.fsPath}`);
    }
  });
}

export function createCopyRelativePathCommand() {
  return registerCommand(Command.CopyRelativePath, (item) => {
    if (item && item.resourceUri) {
      const relativePath = vscode.workspace.asRelativePath(item.resourceUri);
      vscode.env.clipboard.writeText(relativePath);
      showToastMessage(ToastKind.Info, `Copied: ${relativePath}`);
    }
  });
}
