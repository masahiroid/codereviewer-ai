import type { ScanConstraints } from '../types/config';
import type { ScanRequestChunk, ScanResult, ScanScope, ScanTargetFile } from '../types/scanResult';
import { mergeScanResults } from '../utils/resultUtils';
import { Logger } from './logger';
import { OpenAiClient } from './openaiClient';

export interface ScanExecutionInput {
  apiKey: string;
  model: string;
  scope: ScanScope;
  files: ScanTargetFile[];
}

export class ScanService {
  public constructor(
    private readonly openAiClient: OpenAiClient,
    private readonly logger: Logger,
    private readonly getConstraints: () => ScanConstraints
  ) {}

  public async scan(input: ScanExecutionInput, progress?: { report(message: string, increment?: number): void }): Promise<ScanResult> {
    const constraints = this.getConstraints();
    const chunks = chunkFiles(input.files, constraints.maxFilesPerRequest);
    const results: ScanResult[] = [];
    const totalChunks = chunks.length;

    for (let start = 0; start < totalChunks; start += constraints.maxConcurrentRequests) {
      const batch = chunks.slice(start, start + constraints.maxConcurrentRequests);
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          progress?.report(`診断中 ${chunk.index}/${totalChunks}: ${chunk.files.length}ファイル`, Math.round(100 / totalChunks));
          return this.openAiClient.scanFiles({
            apiKey: input.apiKey,
            model: input.model,
            scope: input.scope,
            files: chunk.files
          });
        })
      );

      results.push(...batchResults);
      this.logger.info('Completed scan batch', { completedChunks: Math.min(start + batch.length, totalChunks), totalChunks });
    }

    return mergeScanResults(results);
  }
}

export function chunkFiles(files: ScanTargetFile[], maxFilesPerRequest: number): ScanRequestChunk[] {
  if (files.length === 0) {
    return [];
  }

  const chunkSize = Math.max(maxFilesPerRequest, 1);
  const chunks: ScanRequestChunk[] = [];

  for (let index = 0; index < files.length; index += chunkSize) {
    chunks.push({
      index: chunks.length + 1,
      files: files.slice(index, index + chunkSize)
    });
  }

  return chunks;
}
