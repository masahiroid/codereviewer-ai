import * as vscode from 'vscode';
import type { ExtensionSettings } from '../types/config';
import type { ScanScope } from '../types/scanResult';

const SELECTED_MODEL_KEY = 'codeInspector.selectedModel';
const OMIT_DATED_MODELS_KEY = 'codeInspector.omitDatedModels';
const LAST_SCOPE_KEY = 'codeInspector.lastScope';

const DEFAULT_SETTINGS: ExtensionSettings = {
  selectedModel: 'gpt-4.1-mini',
  omitDatedModels: true,
  lastScope: 'currentFile'
};

export class StateStore {
  public constructor(private readonly workspaceState: vscode.Memento) {}

  public getSettings(): ExtensionSettings {
    return {
      selectedModel: this.workspaceState.get<string>(SELECTED_MODEL_KEY, DEFAULT_SETTINGS.selectedModel),
      omitDatedModels: this.workspaceState.get<boolean>(OMIT_DATED_MODELS_KEY, DEFAULT_SETTINGS.omitDatedModels),
      lastScope: this.workspaceState.get<ScanScope>(LAST_SCOPE_KEY, DEFAULT_SETTINGS.lastScope)
    };
  }

  public async updateSelectedModel(model: string): Promise<void> {
    await this.workspaceState.update(SELECTED_MODEL_KEY, model);
  }

  public async updateOmitDatedModels(value: boolean): Promise<void> {
    await this.workspaceState.update(OMIT_DATED_MODELS_KEY, value);
  }

  public async updateLastScope(scope: ScanScope): Promise<void> {
    await this.workspaceState.update(LAST_SCOPE_KEY, scope);
  }
}
