import * as path from 'path';
import * as vscode from 'vscode';
import type { ScanConstraints } from '../types/config';
import type { ScanTargetFile } from '../types/scanResult';
import { isBinaryPath, isSensitivePath } from '../utils/fileUtils';
import { Logger } from './logger';

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface FileCollectionResult {
  files: ScanTargetFile[];
  skipped: SkippedFile[];
}

const DEFAULT_WORKSPACE_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/out/**',
  '**/bin/**'
];

export class FileCollector {
  public constructor(private readonly logger: Logger) {}

  public async collectCurrentFile(editor: vscode.TextEditor | undefined): Promise<FileCollectionResult> {
    if (!editor) {
      throw new Error('アクティブなファイルがありません。');
    }

    const file = await this.readUri(editor.document.uri, this.getConstraints());
    return {
      files: file ? [file] : [],
      skipped: file ? [] : [{ path: editor.document.uri.fsPath, reason: '除外ルールに一致' }]
    };
  }

  public async collectSelectedFiles(resourceUri: vscode.Uri | undefined, selectedUris: readonly vscode.Uri[] | undefined): Promise<FileCollectionResult> {
    const uris = deduplicateUris(selectedUris?.length ? selectedUris : resourceUri ? [resourceUri] : []);
    if (uris.length === 0) {
      return this.collectFilesFromQuickPick();
    }

    return this.collectUris(uris, this.getConstraints());
  }

  public async collectWorkspace(folderUri?: vscode.Uri): Promise<FileCollectionResult> {
    const workspaceFolder = folderUri ? vscode.workspace.getWorkspaceFolder(folderUri) : vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('ワークスペースが開かれていません。');
    }

    const constraints = this.getConstraints();
    const excludePatterns = [...DEFAULT_WORKSPACE_EXCLUDES, ...constraints.additionalExcludeGlobs];
    const excludeGlob = `{${excludePatterns.join(',')}}`;
    const relativePattern = new vscode.RelativePattern(workspaceFolder, '**/*');
    const uris = await vscode.workspace.findFiles(relativePattern, excludeGlob);
    return this.collectUris(folderUri ? uris.filter((uri) => uri.fsPath.startsWith(folderUri.fsPath)) : uris, constraints);
  }

  private async collectFilesFromQuickPick(): Promise<FileCollectionResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('ワークスペースが開かれていません。');
    }

    const files = await vscode.workspace.findFiles('**/*', `{${DEFAULT_WORKSPACE_EXCLUDES.join(',')}}`);
    const picks = files.map((uri) => ({
      label: vscode.workspace.asRelativePath(uri),
      uri
    }));

    const selected = await vscode.window.showQuickPick(picks, {
      canPickMany: true,
      placeHolder: '診断するファイルを選択してください'
    });

    if (!selected || selected.length === 0) {
      throw new Error('診断対象のファイルが選択されませんでした。');
    }

    return this.collectUris(selected.map((entry) => entry.uri), this.getConstraints());
  }

  private async collectUris(uris: readonly vscode.Uri[], constraints: ScanConstraints): Promise<FileCollectionResult> {
    const files: ScanTargetFile[] = [];
    const skipped: SkippedFile[] = [];

    for (const uri of deduplicateUris(uris)) {
      const file = await this.readUri(uri, constraints);
      if (file) {
        files.push(file);
      } else {
        skipped.push({ path: uri.fsPath, reason: '除外ルールまたはサイズ制限に一致' });
      }
    }

    if (files.length === 0) {
      throw new Error('診断対象となるテキストファイルが見つかりませんでした。');
    }

    this.logger.info('Collected files for scan', { selected: files.length, skipped: skipped.length });
    return { files, skipped };
  }

  private async readUri(uri: vscode.Uri, constraints: ScanConstraints): Promise<ScanTargetFile | undefined> {
    if (uri.scheme !== 'file') {
      return undefined;
    }

    const relativePath = vscode.workspace.asRelativePath(uri, false);
    if (isBinaryPath(relativePath) || isSensitivePath(relativePath)) {
      return undefined;
    }

    const stat = await vscode.workspace.fs.stat(uri);
    const maxBytes = constraints.maxFileSizeKb * 1024;
    if (stat.size > maxBytes) {
      return undefined;
    }

    const buffer = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(buffer).toString('utf8');
    if (!content.trim()) {
      return undefined;
    }

    return {
      path: normalizePath(relativePath),
      content
    };
  }

  private getConstraints(): ScanConstraints {
    const configuration = vscode.workspace.getConfiguration('codeInspector');
    return {
      maxFileSizeKb: configuration.get<number>('maxFileSizeKb', 128),
      maxFilesPerRequest: configuration.get<number>('maxFilesPerRequest', 8),
      maxConcurrentRequests: configuration.get<number>('maxConcurrentRequests', 2),
      additionalExcludeGlobs: configuration.get<string[]>('additionalExcludeGlobs', [])
    };
  }
}

function deduplicateUris(uris: readonly vscode.Uri[]): vscode.Uri[] {
  return [...new Map(uris.map((uri) => [uri.toString(), uri])).values()];
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}
