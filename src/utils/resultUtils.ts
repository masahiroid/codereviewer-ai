import type { ScanIssue, ScanResult, ScanSummary, Severity } from '../types/scanResult';

const DEFAULT_SUMMARY: ScanSummary = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0
};

export function createSummary(issues: ScanIssue[]): ScanSummary {
  return issues.reduce<ScanSummary>((summary, issue) => {
    summary[issue.severity] += 1;
    return summary;
  }, { ...DEFAULT_SUMMARY });
}

export function sortIssues(issues: ScanIssue[]): ScanIssue[] {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };

  return [...issues].sort((left, right) => {
    const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }

    const fileDiff = left.file.localeCompare(right.file);
    if (fileDiff !== 0) {
      return fileDiff;
    }

    return left.line - right.line;
  });
}

export function mergeScanResults(results: ScanResult[]): ScanResult {
  const issues = sortIssues(results.flatMap((result) => result.issues));
  const latest = results.at(-1);

  return {
    scanId: latest?.scanId ?? crypto.randomUUID(),
    model: latest?.model ?? '',
    scope: latest?.scope ?? 'currentFile',
    createdAt: latest?.createdAt ?? new Date().toISOString(),
    summary: createSummary(issues),
    issues
  };
}
