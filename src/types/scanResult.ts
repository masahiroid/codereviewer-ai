export type ScanScope = 'currentFile' | 'selectedFiles' | 'workspace';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IssueCategory = 'vulnerability' | 'quality';

export interface ScanIssue {
  file: string;
  line: number;
  severity: Severity;
  category: IssueCategory;
  title: string;
  description: string;
  suggestion: string;
  rationale: string;
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ScanResult {
  scanId: string;
  model: string;
  scope: ScanScope;
  createdAt: string;
  summary: ScanSummary;
  issues: ScanIssue[];
}

export interface ScanTargetFile {
  path: string;
  content: string;
}

export interface ScanRequestChunk {
  index: number;
  files: ScanTargetFile[];
}
