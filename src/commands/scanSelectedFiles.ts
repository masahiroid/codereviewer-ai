import * as vscode from 'vscode';

export function registerScanSelectedFilesCommand(
  handler: (resourceUri?: vscode.Uri, selectedUris?: readonly vscode.Uri[]) => Promise<void>
): vscode.Disposable {
  return vscode.commands.registerCommand('codeInspector.scanSelectedFiles', handler);
}
