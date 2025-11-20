import * as vscode from 'vscode';
import { Command, ToastKind, openTextDocument, registerCommand, showToastMessage } from '../common/lib/vscode-utils';
import { LOG_FILE_PATH } from '../common/utils/logger';

export function createShowLogsCommand() {
  return registerCommand(Command.ShowLogs, async () => {
    try {
      const doc = await openTextDocument(vscode.Uri.file(LOG_FILE_PATH));
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (error) {
      showToastMessage(ToastKind.Error, `Failed to open logs: ${error}`);
    }
  });
}
