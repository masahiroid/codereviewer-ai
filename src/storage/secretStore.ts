import * as vscode from 'vscode';

const API_KEY_SECRET = 'codeInspector.apiKey';

export class SecretStore {
  public constructor(private readonly secrets: vscode.SecretStorage) {}

  public getApiKey(): Thenable<string | undefined> {
    return this.secrets.get(API_KEY_SECRET);
  }

  public setApiKey(apiKey: string): Thenable<void> {
    return this.secrets.store(API_KEY_SECRET, apiKey);
  }

  public deleteApiKey(): Thenable<void> {
    return this.secrets.delete(API_KEY_SECRET);
  }
}
