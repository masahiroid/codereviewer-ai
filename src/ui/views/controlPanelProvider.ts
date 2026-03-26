import * as vscode from 'vscode';
import type { ScanScope } from '../../types/scanResult';

interface ControlPanelState {
  hasApiKey: boolean;
  models: string[];
  selectedModel: string;
  omitDatedModels: boolean;
  lastScope: ScanScope;
  busy: boolean;
  statusMessage?: string;
}

interface ControlPanelMessage {
  type: 'saveApiKey' | 'refreshModels' | 'updateSettings' | 'runScan' | 'requestState';
  apiKey?: string;
  selectedModel?: string;
  omitDatedModels?: boolean;
  scope?: ScanScope;
}

export interface ControlPanelActions {
  onSaveApiKey(apiKey: string): Promise<void>;
  onRefreshModels(): Promise<void>;
  onUpdateSettings(update: { selectedModel?: string; omitDatedModels?: boolean; lastScope?: ScanScope }): Promise<void>;
  onRunScan(scope: ScanScope): Promise<void>;
  onRequestState(): Promise<ControlPanelState>;
}

export class ControlPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'codeInspector.controlPanel';

  private view?: vscode.WebviewView;
  private state: ControlPanelState = {
    hasApiKey: false,
    models: [],
    selectedModel: 'gpt-4.1-mini',
    omitDatedModels: true,
    lastScope: 'currentFile',
    busy: false
  };

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly actions: ControlPanelActions
  ) {}

  public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.onDidReceiveMessage(async (message: ControlPanelMessage) => {
      try {
        switch (message.type) {
          case 'saveApiKey':
            if (message.apiKey) {
              this.setBusy(true, 'APIキーを保存しています');
              await this.actions.onSaveApiKey(message.apiKey);
            }
            break;
          case 'refreshModels':
            this.setBusy(true, 'モデル一覧を取得しています');
            await this.actions.onRefreshModels();
            break;
          case 'updateSettings':
            this.setBusy(true);
            await this.actions.onUpdateSettings({
              selectedModel: message.selectedModel,
              omitDatedModels: message.omitDatedModels,
              lastScope: message.scope
            });
            break;
          case 'runScan':
            if (message.scope) {
              this.setBusy(true, '診断を開始しています');
              await this.actions.onRunScan(message.scope);
            }
            break;
          case 'requestState':
            await this.refreshState();
            return;
        }

        await this.refreshState();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.setBusy(false, detail);
        void vscode.window.showErrorMessage(detail);
      }
    });

    await this.refreshState();
  }

  public async refreshState(statusMessage?: string): Promise<void> {
    this.state = await this.actions.onRequestState();
    if (statusMessage !== undefined) {
      this.state.statusMessage = statusMessage;
    }

    this.render();
  }

  public setBusy(busy: boolean, statusMessage?: string): void {
    this.state = {
      ...this.state,
      busy,
      statusMessage
    };
    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }

    const nonce = getNonce();
    const options = this.state.models
      .map((model) => `<option value="${escapeHtml(model)}" ${model === this.state.selectedModel ? 'selected' : ''}>${escapeHtml(model)}</option>`)
      .join('');
    const disabled = this.state.busy ? 'disabled' : '';

    this.view.webview.html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code Inspector</title>
  <style>
    :root {
      color-scheme: light dark;
      --accent: #006b5f;
      --accent-soft: rgba(0, 107, 95, 0.12);
      --border: rgba(127, 127, 127, 0.2);
    }
    body {
      font-family: "Hiragino Sans", "Yu Gothic UI", sans-serif;
      padding: 14px;
      color: var(--vscode-foreground);
      background: linear-gradient(180deg, var(--vscode-editor-background) 0%, color-mix(in srgb, var(--vscode-editor-background) 88%, var(--accent)) 100%);
    }
    .panel {
      display: grid;
      gap: 14px;
    }
    .section {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px;
      background: color-mix(in srgb, var(--vscode-editor-background) 82%, white 4%);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
    }
    h2 {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--vscode-foreground) 70%, var(--accent));
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      margin-bottom: 10px;
    }
    input[type="password"], select {
      width: 100%;
      box-sizing: border-box;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      padding: 10px 12px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    button {
      border: none;
      border-radius: 999px;
      padding: 10px 12px;
      cursor: pointer;
      background: var(--accent);
      color: white;
      font-weight: 700;
    }
    button.secondary {
      background: var(--accent-soft);
      color: var(--vscode-foreground);
      border: 1px solid var(--border);
    }
    button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .scope-list {
      display: grid;
      gap: 8px;
    }
    .scope-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .status {
      font-size: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--accent-soft);
      min-height: 18px;
    }
    .meta {
      font-size: 12px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="section">
      <h2>接続設定</h2>
      <label>
        APIキー
        <input id="apiKey" type="password" placeholder="sk-..." ${disabled} />
      </label>
      <div class="row">
        <button id="saveApiKey" ${disabled}>保存</button>
        <button id="refreshModels" class="secondary" ${disabled}>モデル更新</button>
      </div>
      <p class="meta">APIキー状態: ${this.state.hasApiKey ? '設定済み' : '未設定'}</p>
    </div>

    <div class="section">
      <h2>モデル</h2>
      <label>
        モデル選択
        <select id="model" ${disabled}>
          ${options || '<option value="">モデル未取得</option>'}
        </select>
      </label>
      <label class="scope-item">
        <input id="omitDatedModels" type="checkbox" ${this.state.omitDatedModels ? 'checked' : ''} ${disabled} />
        日付付きモデルを除外
      </label>
    </div>

    <div class="section">
      <h2>診断対象</h2>
      <div class="scope-list">
        ${renderScopeOption('currentFile', '現在ファイル', this.state.lastScope, disabled)}
        ${renderScopeOption('selectedFiles', '複数選択', this.state.lastScope, disabled)}
        ${renderScopeOption('workspace', 'プロジェクト全体', this.state.lastScope, disabled)}
      </div>
      <div style="height: 10px"></div>
      <button id="runScan" ${disabled}>診断実行</button>
    </div>

    <div class="status">${escapeHtml(this.state.statusMessage ?? '')}</div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function getScope() {
      const selected = document.querySelector('input[name="scope"]:checked');
      return selected ? selected.value : 'currentFile';
    }

    document.getElementById('saveApiKey').addEventListener('click', () => {
      const apiKey = document.getElementById('apiKey').value.trim();
      vscode.postMessage({ type: 'saveApiKey', apiKey });
    });

    document.getElementById('refreshModels').addEventListener('click', () => {
      vscode.postMessage({ type: 'refreshModels' });
    });

    document.getElementById('model').addEventListener('change', (event) => {
      vscode.postMessage({ type: 'updateSettings', selectedModel: event.target.value, scope: getScope(), omitDatedModels: document.getElementById('omitDatedModels').checked });
    });

    document.getElementById('omitDatedModels').addEventListener('change', (event) => {
      vscode.postMessage({ type: 'updateSettings', selectedModel: document.getElementById('model').value, scope: getScope(), omitDatedModels: event.target.checked });
    });

    document.querySelectorAll('input[name="scope"]').forEach((input) => {
      input.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateSettings', selectedModel: document.getElementById('model').value, scope: getScope(), omitDatedModels: document.getElementById('omitDatedModels').checked });
      });
    });

    document.getElementById('runScan').addEventListener('click', () => {
      vscode.postMessage({ type: 'runScan', scope: getScope() });
    });

  </script>
</body>
</html>`;
  }
}

function renderScopeOption(scope: ScanScope, label: string, currentScope: ScanScope, disabled: string): string {
  return `<label class="scope-item"><input type="radio" name="scope" value="${scope}" ${currentScope === scope ? 'checked' : ''} ${disabled} /> ${label}</label>`;
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
