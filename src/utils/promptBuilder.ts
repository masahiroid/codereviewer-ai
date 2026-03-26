import type { ScanScope, Severity, ScanTargetFile } from '../types/scanResult';

const SEVERITY_GUIDE: Record<Severity, string> = {
  critical: '容易に悪用でき、重大な情報漏えい・権限昇格・リモート実行につながる。',
  high: '悪用された場合の影響が大きく、優先的な是正が必要。',
  medium: '即時性は低いが、運用中に不具合・脆弱性へ発展する可能性がある。',
  low: '小さな問題だが保守性・安全性の低下要因となる。'
};

export function buildScanPrompt(scope: ScanScope, files: ScanTargetFile[]): string {
  const fileBlocks = files
    .map((file) => `FILE: ${file.path}\n\n\`\`\`\n${file.content}\n\`\`\``)
    .join('\n\n');

  const severityRules = Object.entries(SEVERITY_GUIDE)
    .map(([severity, description]) => `- ${severity}: ${description}`)
    .join('\n');

  return [
    'あなたはセキュリティレビューとコード品質レビューを担当するシニアエンジニアです。',
    `診断スコープ: ${scope}`,
    '以下のコードを読み、脆弱性とコード品質の問題だけを抽出してください。',
    '推測ではなく、コード上の根拠がある問題のみを報告してください。',
    '行番号は可能な限り実コードに対応させてください。',
    '重大度は次の定義に従ってください。',
    severityRules,
    '各指摘の title, description, suggestion, rationale はすべて日本語で記述してください。',
    '問題がない場合は issues を空配列にしてください。',
    '対象コード:',
    fileBlocks
  ].join('\n\n');
}
