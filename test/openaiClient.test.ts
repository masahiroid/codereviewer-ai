import { describe, expect, it } from 'vitest';
import { parseScanIssuesFromContent } from '../src/services/openaiClient';

describe('openaiClient', () => {
  it('診断JSONからissuesを抽出する', () => {
    const issues = parseScanIssuesFromContent(JSON.stringify({
      issues: [
        {
          file: 'src/auth/login.ts',
          line: 42,
          severity: 'high',
          category: 'vulnerability',
          title: '入力値の検証不足',
          description: 'ユーザー入力がそのまま利用されています。',
          suggestion: 'バリデーションを追加してください。',
          rationale: '入力が未検証です。'
        }
      ]
    }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      file: 'src/auth/login.ts',
      line: 42,
      severity: 'high',
      category: 'vulnerability'
    });
  });

  it('不正なlineを1に補正する', () => {
    const issues = parseScanIssuesFromContent(JSON.stringify({
      issues: [
        {
          file: 'src/index.ts',
          line: 'abc',
          severity: 'unknown',
          category: 'other',
          title: 'title'
        }
      ]
    }));

    expect(issues[0]?.line).toBe(1);
    expect(issues[0]?.severity).toBe('medium');
    expect(issues[0]?.category).toBe('quality');
  });
});
