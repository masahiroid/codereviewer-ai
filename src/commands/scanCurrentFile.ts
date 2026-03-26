import * as vscode from 'vscode';

export function registerScanCurrentFileCommand(handler: () => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand('codeInspector.scanCurrentFile', handler);
}
