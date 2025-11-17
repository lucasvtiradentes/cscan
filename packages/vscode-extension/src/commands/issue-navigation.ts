import * as vscode from 'vscode';
import { SearchResultProvider } from '../sidebar/search-provider';
import { logger } from '../common/utils/logger';

let currentIssueIndex = -1;

export function createGoToNextIssueCommand(searchProvider: SearchResultProvider) {
  return vscode.commands.registerCommand('lino.goToNextIssue', async () => {
    const results = searchProvider.getResults();

    if (results.length === 0) {
      vscode.window.showInformationMessage('No issues found');
      return;
    }

    currentIssueIndex = (currentIssueIndex + 1) % results.length;
    const issue = results[currentIssueIndex];

    logger.debug(`Navigating to next issue: ${currentIssueIndex + 1}/${results.length}`);

    const doc = await vscode.workspace.openTextDocument(issue.uri);
    const editor = await vscode.window.showTextDocument(doc);

    const position = new vscode.Position(issue.line, issue.column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

    vscode.window.setStatusBarMessage(`Issue ${currentIssueIndex + 1}/${results.length}: ${issue.rule}`, 3000);
  });
}

export function createGoToPreviousIssueCommand(searchProvider: SearchResultProvider) {
  return vscode.commands.registerCommand('lino.goToPreviousIssue', async () => {
    const results = searchProvider.getResults();

    if (results.length === 0) {
      vscode.window.showInformationMessage('No issues found');
      return;
    }

    if (currentIssueIndex === -1) {
      currentIssueIndex = results.length - 1;
    } else {
      currentIssueIndex = (currentIssueIndex - 1 + results.length) % results.length;
    }

    const issue = results[currentIssueIndex];

    logger.debug(`Navigating to previous issue: ${currentIssueIndex + 1}/${results.length}`);

    const doc = await vscode.workspace.openTextDocument(issue.uri);
    const editor = await vscode.window.showTextDocument(doc);

    const position = new vscode.Position(issue.line, issue.column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

    vscode.window.setStatusBarMessage(`Issue ${currentIssueIndex + 1}/${results.length}: ${issue.rule}`, 3000);
  });
}

export function resetIssueIndex() {
  currentIssueIndex = -1;
}
