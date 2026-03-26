import * as vscode from 'vscode';

export function registerScanWorkspaceCommand(handler: (resourceUri?: vscode.Uri) => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand('codeInspector.scanWorkspace', handler);
}
