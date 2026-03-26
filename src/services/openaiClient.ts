import type { ScanIssue, ScanResult, ScanScope, ScanTargetFile } from '../types/scanResult';
import { createSummary, sortIssues } from '../utils/resultUtils';
import { buildScanPrompt } from '../utils/promptBuilder';
import { Logger } from './logger';

interface OpenAiModelResponse {
  data?: Array<{ id?: string }>;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface RawIssue {
  file?: unknown;
  line?: unknown;
  severity?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  suggestion?: unknown;
  rationale?: unknown;
}

export interface OpenAiScanRequest {
  apiKey: string;
  model: string;
  scope: ScanScope;
  files: ScanTargetFile[];
}

export class OpenAiClient {
  private static readonly baseUrl = 'https://api.openai.com/v1';

  public constructor(private readonly logger: Logger) {}

  public async listModels(apiKey: string): Promise<string[]> {
    const response = await this.requestJson<OpenAiModelResponse>(`${OpenAiClient.baseUrl}/models`, {
      method: 'GET',
      headers: this.buildHeaders(apiKey)
    });

    return (response.data ?? [])
      .map((entry) => entry.id)
      .filter((modelId): modelId is string => typeof modelId === 'string');
  }

  public async scanFiles(request: OpenAiScanRequest): Promise<ScanResult> {
    const prompt = buildScanPrompt(request.scope, request.files);
    const response = await this.requestJson<ChatCompletionResponse>(`${OpenAiClient.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(request.apiKey),
      body: JSON.stringify({
        model: request.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'あなたはアプリケーションセキュリティとコード品質を専門とするシニアエンジニアです。',
              '必ずJSON形式のみで返してください。JSON以外のテキストは一切含めないでください。',
              'title・description・suggestion・rationaleはすべて日本語で記述してください。',
              'スキーマ: {"issues": [{"file": string, "line": number, "severity": "critical"|"high"|"medium"|"low", "category": "vulnerability"|"quality", "title": string, "description": string, "suggestion": string, "rationale": string}]}'
            ].join(' ')
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAIから診断結果が返されませんでした。');
    }

    const issues = parseScanIssuesFromContent(content);

    return {
      scanId: crypto.randomUUID(),
      model: request.model,
      scope: request.scope,
      createdAt: new Date().toISOString(),
      summary: createSummary(issues),
      issues: sortIssues(issues)
    };
  }

  private buildHeaders(apiKey: string): HeadersInit {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  private async requestJson<T>(url: string, init: RequestInit, attempt = 1): Promise<T> {
    this.logger.debug('OpenAI request', { url, attempt });

    const response = await fetch(url, init);
    const responseText = await response.text();

    if (!response.ok) {
      const shouldRetry = attempt < 3 && (response.status === 429 || response.status >= 500);
      this.logger.error('OpenAI request failed', { url, status: response.status, body: responseText, attempt });

      if (shouldRetry) {
        await delay(500 * attempt);
        return this.requestJson<T>(url, init, attempt + 1);
      }

      throw new Error(extractErrorMessage(response.status, responseText));
    }

    return JSON.parse(responseText) as T;
  }
}

export function parseScanIssuesFromContent(content: string): ScanIssue[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`診断結果JSONの解析に失敗しました: ${String(error)}`);
  }

  const rawIssues = (parsed as { issues?: RawIssue[] }).issues;
  if (!Array.isArray(rawIssues)) {
    return [];
  }

  return rawIssues.flatMap(normalizeIssue);
}

function normalizeIssue(rawIssue: RawIssue): ScanIssue[] {
  if (typeof rawIssue.file !== 'string' || typeof rawIssue.title !== 'string') {
    return [];
  }

  const severity = normalizeSeverity(rawIssue.severity);
  const category = normalizeCategory(rawIssue.category);
  const line = normalizeLine(rawIssue.line);

  return [
    {
      file: rawIssue.file,
      line,
      severity,
      category,
      title: rawIssue.title,
      description: normalizeText(rawIssue.description),
      suggestion: normalizeText(rawIssue.suggestion),
      rationale: normalizeText(rawIssue.rationale)
    }
  ];
}

function normalizeSeverity(value: unknown): ScanIssue['severity'] {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low' ? value : 'medium';
}

function normalizeCategory(value: unknown): ScanIssue['category'] {
  return value === 'vulnerability' || value === 'quality' ? value : 'quality';
}

function normalizeLine(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '根拠の記載なし';
}

function extractErrorMessage(status: number, responseText: string): string {
  try {
    const payload = JSON.parse(responseText) as { error?: { message?: string } };
    return payload.error?.message ?? `OpenAI API呼び出しに失敗しました。status=${status}`;
  } catch {
    return `OpenAI API呼び出しに失敗しました。status=${status}`;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
