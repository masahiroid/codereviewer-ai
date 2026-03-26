import * as vscode from 'vscode';

export function registerRefreshModelsCommand(handler: () => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand('codeInspector.refreshModels', handler);
}
