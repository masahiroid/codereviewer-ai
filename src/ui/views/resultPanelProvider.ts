import * as path from 'path';
import * as vscode from 'vscode';
import type { ScanResult } from '../../types/scanResult';

interface ResultPanelState {
  result: ScanResult;
  skippedFiles: Array<{ path: string; reason: string }>;
}

interface ResultPanelMessage {
  type: 'openLocation';
  file: string;
  line: number;
}

export class ResultPanelProvider {
  private panel?: vscode.WebviewPanel;
  private state?: ResultPanelState;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public reveal(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    void vscode.window.showInformationMessage('まだ診断結果がありません。');
  }

  public showResult(result: ScanResult, skippedFiles: Array<{ path: string; reason: string }>): void {
    this.state = { result, skippedFiles };

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'codeInspector.results',
        'Code Inspector Results',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri]
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage(async (message: ResultPanelMessage) => {
        if (message.type === 'openLocation') {
          await this.openLocation(message.file, message.line);
        }
      });
    }

    this.panel.title = `Code Inspector: ${result.summary.critical + result.summary.high + result.summary.medium + result.summary.low}件`;
    this.panel.webview.html = this.getHtml(this.panel.webview, this.state);
    this.panel.reveal(vscode.ViewColumn.Beside);
  }

  private async openLocation(file: string, line: number): Promise<void> {
    const uri = await resolveWorkspaceFile(file);
    if (!uri) {
      void vscode.window.showErrorMessage(`ファイルを開けませんでした: ${file}`);
      return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    const position = new vscode.Position(Math.max(line - 1, 0), 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  private getHtml(webview: vscode.Webview, state: ResultPanelState): string {
    const nonce = getNonce();
    const issueCards = state.result.issues
      .map((issue) => `
        <article class="issue ${issue.severity}">
          <div class="issue-header">
            <span class="badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
            <span class="badge outline">${issue.category === 'vulnerability' ? '脆弱性' : '品質'}</span>
            <button class="link" data-file="${escapeHtml(issue.file)}" data-line="${issue.line}">${escapeHtml(issue.file)}:${issue.line}</button>
          </div>
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.description)}</p>
          <p><strong>根拠:</strong> ${escapeHtml(issue.rationale)}</p>
          <p><strong>推奨修正:</strong> ${escapeHtml(issue.suggestion)}</p>
        </article>
      `)
      .join('');

    const skipped = state.skippedFiles.length
      ? `<section class="skipped"><h2>除外されたファイル</h2>${state.skippedFiles.map((entry) => `<div>${escapeHtml(entry.path)} - ${escapeHtml(entry.reason)}</div>`).join('')}</section>`
      : '';

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code Inspector Results</title>
  <style>
    :root {
      color-scheme: light dark;
      --critical: #8f1d2c;
      --high: #bf4f00;
      --medium: #b88c00;
      --low: #2f6f44;
      --panel: color-mix(in srgb, var(--vscode-editor-background) 92%, white 4%);
      --border: rgba(127, 127, 127, 0.22);
    }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Avenir Next", "Hiragino Sans", sans-serif;
      color: var(--vscode-foreground);
      background:
        radial-gradient(circle at top left, rgba(0, 107, 95, 0.18), transparent 28%),
        linear-gradient(180deg, var(--vscode-editor-background), color-mix(in srgb, var(--vscode-editor-background) 84%, #0b3d35 16%));
    }
    .hero {
      display: grid;
      gap: 16px;
      margin-bottom: 20px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }
    .card, .issue, .skipped {
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 16px;
      background: var(--panel);
      backdrop-filter: blur(4px);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.12);
    }
    .metric {
      font-size: 28px;
      font-weight: 800;
      margin-top: 8px;
    }
    .issues {
      display: grid;
      gap: 14px;
    }
    .issue-header {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-flex;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
    }
    .badge.critical { background: rgba(143, 29, 44, 0.2); color: #ffb7c1; }
    .badge.high { background: rgba(191, 79, 0, 0.2); color: #ffd1a4; }
    .badge.medium { background: rgba(184, 140, 0, 0.2); color: #ffe89e; }
    .badge.low { background: rgba(47, 111, 68, 0.2); color: #cdebd6; }
    .badge.outline { background: transparent; border: 1px solid var(--border); }
    .link {
      border: none;
      background: transparent;
      color: var(--vscode-textLink-foreground);
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
    }
    h1, h2, h3, p {
      margin: 0;
    }
    h1 {
      font-size: 28px;
      letter-spacing: -0.03em;
    }
    h3 {
      font-size: 18px;
      margin-bottom: 8px;
    }
    p {
      margin-top: 8px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <section class="hero">
    <div>
      <h1>診断結果</h1>
      <p>モデル: ${escapeHtml(state.result.model)} / スコープ: ${escapeHtml(state.result.scope)} / 実行日時: ${escapeHtml(state.result.createdAt)}</p>
    </div>
    <section class="summary">
      ${renderMetricCard('Critical', state.result.summary.critical, 'critical')}
      ${renderMetricCard('High', state.result.summary.high, 'high')}
      ${renderMetricCard('Medium', state.result.summary.medium, 'medium')}
      ${renderMetricCard('Low', state.result.summary.low, 'low')}
      <div class="card">
        <div>総問題数</div>
        <div class="metric">${state.result.issues.length}</div>
      </div>
    </section>
  </section>
  <section class="issues">
    ${issueCards || '<div class="card">問題は検出されませんでした。</div>'}
  </section>
  ${skipped}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.link').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({
          type: 'openLocation',
          file: button.dataset.file,
          line: Number(button.dataset.line || '1')
        });
      });
    });
  </script>
</body>
</html>`;
  }
}

function renderMetricCard(label: string, value: number, tone: string): string {
  return `<div class="card"><div>${label}</div><div class="metric" style="color: var(--${tone});">${value}</div></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNonce(): string {
  return Math.random().toString(36).slice(2);
}

async function resolveWorkspaceFile(relativePath: string): Promise<vscode.Uri | undefined> {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const candidate = vscode.Uri.file(path.join(folder.uri.fsPath, relativePath));
    try {
      await vscode.workspace.fs.stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return undefined;
}
