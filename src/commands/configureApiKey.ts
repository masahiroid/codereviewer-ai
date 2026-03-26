import * as vscode from 'vscode';

export function registerConfigureApiKeyCommand(handler: () => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand('codeInspector.configureApiKey', handler);
}
