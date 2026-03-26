import * as vscode from 'vscode';

export function registerOpenResultsCommand(handler: () => void): vscode.Disposable {
  return vscode.commands.registerCommand('codeInspector.openResults', handler);
}
