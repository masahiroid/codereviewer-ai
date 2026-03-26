import * as vscode from 'vscode';
import { registerConfigureApiKeyCommand } from './commands/configureApiKey';
import { registerOpenResultsCommand } from './commands/openResults';
import { registerRefreshModelsCommand } from './commands/refreshModels';
import { registerScanCurrentFileCommand } from './commands/scanCurrentFile';
import { registerScanSelectedFilesCommand } from './commands/scanSelectedFiles';
import { registerScanWorkspaceCommand } from './commands/scanWorkspace';
import { FileCollector } from './services/fileCollector';
import { Logger } from './services/logger';
import { ModelService } from './services/modelService';
import { OpenAiClient } from './services/openaiClient';
import { ScanService } from './services/scanService';
import { SecretStore } from './storage/secretStore';
import { StateStore } from './storage/stateStore';
import type { ScanScope } from './types/scanResult';
import { ControlPanelProvider, type ControlPanelActions } from './ui/views/controlPanelProvider';
import { ResultPanelProvider } from './ui/views/resultPanelProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger();
  const secretStore = new SecretStore(context.secrets);
  const stateStore = new StateStore(context.workspaceState);
  const openAiClient = new OpenAiClient(logger);
  const modelService = new ModelService(openAiClient);
  const fileCollector = new FileCollector(logger);
  const resultPanel = new ResultPanelProvider(context.extensionUri);
  const scanService = new ScanService(openAiClient, logger, () => getScanConstraints());

  let cachedModels: string[] = [];

  const controlPanelActions: ControlPanelActions = {
    onSaveApiKey: async (apiKey) => {
      const normalizedApiKey = apiKey.trim();
      if (!normalizedApiKey) {
        throw new Error('APIキーを入力してください。');
      }

      await secretStore.setApiKey(normalizedApiKey);
      logger.info('Saved API key');
      await refreshModels(true);
      void vscode.window.showInformationMessage('APIキーを保存しました。');
    },
    onRefreshModels: async () => {
      await refreshModels(true);
    },
    onUpdateSettings: async (update) => {
      if (typeof update.selectedModel === 'string' && update.selectedModel) {
        await stateStore.updateSelectedModel(update.selectedModel);
      }
      if (typeof update.omitDatedModels === 'boolean') {
        const previous = stateStore.getSettings().omitDatedModels;
        await stateStore.updateOmitDatedModels(update.omitDatedModels);
        if (previous !== update.omitDatedModels) {
          await refreshModels(false);
        }
      }
      if (update.lastScope) {
        await stateStore.updateLastScope(update.lastScope);
      }
    },
    onRunScan: async (scope) => {
      await runScan(scope);
    },
    onRequestState: async () => getControlPanelState(cachedModels)
  };

  const controlPanelProvider = new ControlPanelProvider(context.extensionUri, controlPanelActions);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ControlPanelProvider.viewId, controlPanelProvider),
    registerConfigureApiKeyCommand(async () => {
      await promptForApiKey(controlPanelProvider, secretStore);
      await controlPanelProvider.refreshState('APIキーを更新しました');
    }),
    registerRefreshModelsCommand(async () => {
      await refreshModels(true);
      await controlPanelProvider.refreshState('モデル一覧を更新しました');
    }),
    registerScanCurrentFileCommand(async () => {
      await runScan('currentFile');
    }),
    registerScanSelectedFilesCommand(async (resourceUri, selectedUris) => {
      await runScan('selectedFiles', resourceUri, selectedUris);
    }),
    registerScanWorkspaceCommand(async (resourceUri) => {
      await runScan('workspace', resourceUri);
    }),
    registerOpenResultsCommand(() => {
      resultPanel.reveal();
    })
  );

  async function refreshModels(showStatusMessage: boolean): Promise<void> {
    const apiKey = await secretStore.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI APIキーが未設定です。サイドバーまたはコマンドから設定してください。');
    }

    const settings = stateStore.getSettings();
    cachedModels = await modelService.listModels(apiKey, settings.omitDatedModels);
    logger.info('Fetched models', { count: cachedModels.length, omitDatedModels: settings.omitDatedModels });

    if (cachedModels.length === 0) {
      throw new Error('利用可能なモデルが見つかりませんでした。除外条件を見直してください。');
    }

    if (!cachedModels.includes(settings.selectedModel)) {
      await stateStore.updateSelectedModel(cachedModels[0]);
    }

    await controlPanelProvider.refreshState(showStatusMessage ? 'モデル一覧を更新しました' : undefined);
  }

  async function runScan(scope: ScanScope, resourceUri?: vscode.Uri, selectedUris?: readonly vscode.Uri[]): Promise<void> {
    const apiKey = await secretStore.getApiKey();
    if (!apiKey) {
      throw new Error('APIキーが未設定です。先に設定してください。');
    }

    const settings = stateStore.getSettings();
    if (cachedModels.length === 0) {
      await refreshModels(false);
    }

    const model = cachedModels.includes(settings.selectedModel) ? settings.selectedModel : cachedModels[0] ?? settings.selectedModel;
    await stateStore.updateSelectedModel(model);
    await stateStore.updateLastScope(scope);
    controlPanelProvider.setBusy(true, '診断対象を収集中です');

    const collection = await collectFiles(scope, resourceUri, selectedUris, fileCollector);

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Code Inspector診断を実行しています',
        cancellable: false
      },
      async (progress) => scanService.scan({
        apiKey,
        model,
        scope,
        files: collection.files
      }, {
        report: (message, increment) => progress.report({ message, increment })
      })
    );

    resultPanel.showResult(result, collection.skipped);
    await controlPanelProvider.refreshState(`診断完了: ${result.issues.length}件の問題を検出`);

    if (collection.skipped.length > 0) {
      void vscode.window.showWarningMessage(`${collection.skipped.length}件のファイルを除外しました。詳細は結果ビューを確認してください。`);
    }
  }

  async function getControlPanelState(models: string[]) {
    const settings = stateStore.getSettings();
    return {
      hasApiKey: Boolean(await secretStore.getApiKey()),
      models,
      selectedModel: models.includes(settings.selectedModel) ? settings.selectedModel : models[0] ?? settings.selectedModel,
      omitDatedModels: settings.omitDatedModels,
      lastScope: settings.lastScope,
      busy: false,
      statusMessage: models.length === 0 ? 'APIキー保存後にモデル一覧を取得してください' : undefined
    };
  }
}

export function deactivate(): void {}

async function promptForApiKey(controlPanelProvider: ControlPanelProvider, secretStore: SecretStore): Promise<void> {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'OpenAI APIキーを入力してください',
    password: true,
    ignoreFocusOut: true,
    placeHolder: 'sk-...'
  });

  if (!apiKey) {
    return;
  }

  controlPanelProvider.setBusy(true, 'APIキーを保存しています');
  await secretStore.setApiKey(apiKey.trim());
}

async function collectFiles(
  scope: ScanScope,
  resourceUri: vscode.Uri | undefined,
  selectedUris: readonly vscode.Uri[] | undefined,
  fileCollector: FileCollector
) {
  switch (scope) {
    case 'currentFile':
      return fileCollector.collectCurrentFile(vscode.window.activeTextEditor);
    case 'selectedFiles':
      return fileCollector.collectSelectedFiles(resourceUri, selectedUris);
    case 'workspace':
      return fileCollector.collectWorkspace(resourceUri);
  }
}

function getScanConstraints() {
  const configuration = vscode.workspace.getConfiguration('codeInspector');
  return {
    maxFileSizeKb: configuration.get<number>('maxFileSizeKb', 128),
    maxFilesPerRequest: configuration.get<number>('maxFilesPerRequest', 8),
    maxConcurrentRequests: configuration.get<number>('maxConcurrentRequests', 2),
    additionalExcludeGlobs: configuration.get<string[]>('additionalExcludeGlobs', [])
  };
}
