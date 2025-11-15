import * as vscode from 'vscode';

export function createOpenFileCommand() {
  return vscode.commands.registerCommand('lino.openFile', (uri: vscode.Uri, line: number, column: number) => {
    vscode.workspace.openTextDocument(uri).then((doc) => {
      vscode.window.showTextDocument(doc).then((editor) => {
        const position = new vscode.Position(line, column);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      });
    });
  });
}

export function createCopyPathCommand() {
  return vscode.commands.registerCommand('lino.copyPath', (item: any) => {
    if (item && item.resourceUri) {
      vscode.env.clipboard.writeText(item.resourceUri.fsPath);
      vscode.window.showInformationMessage(`Copied: ${item.resourceUri.fsPath}`);
    }
  });
}

export function createCopyRelativePathCommand() {
  return vscode.commands.registerCommand('lino.copyRelativePath', (item: any) => {
    if (item && item.resourceUri) {
      const relativePath = vscode.workspace.asRelativePath(item.resourceUri);
      vscode.env.clipboard.writeText(relativePath);
      vscode.window.showInformationMessage(`Copied: ${relativePath}`);
    }
  });
}
