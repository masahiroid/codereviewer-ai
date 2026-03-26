import type { ScanScope } from './scanResult';

export interface ExtensionSettings {
  selectedModel: string;
  omitDatedModels: boolean;
  lastScope: ScanScope;
}

export interface ScanConstraints {
  maxFileSizeKb: number;
  maxFilesPerRequest: number;
  maxConcurrentRequests: number;
  additionalExcludeGlobs: string[];
}
