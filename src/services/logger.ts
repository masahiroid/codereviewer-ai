import * as vscode from 'vscode';

export type LogLevel = 'debug' | 'info' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  error: 30
};

export class Logger {
  private readonly outputChannel = vscode.window.createOutputChannel('Code Inspector');

  public debug(message: string, detail?: unknown): void {
    this.log('debug', message, detail);
  }

  public info(message: string, detail?: unknown): void {
    this.log('info', message, detail);
  }

  public error(message: string, detail?: unknown): void {
    this.log('error', message, detail);
  }

  private log(level: LogLevel, message: string, detail?: unknown): void {
    const configuredLevel = vscode.workspace.getConfiguration('codeInspector').get<LogLevel>('logLevel', 'info');
    if (LEVEL_RANK[level] < LEVEL_RANK[configuredLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const suffix = detail === undefined ? '' : ` ${safeStringify(detail)}`;
    this.outputChannel.appendLine(`[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
