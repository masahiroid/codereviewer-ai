import { describe, expect, it } from 'vitest';
import { buildScanPrompt } from '../src/utils/promptBuilder';

describe('promptBuilder', () => {
  it('スコープとファイル内容を含むプロンプトを組み立てる', () => {
    const prompt = buildScanPrompt('currentFile', [
      {
        path: 'src/index.ts',
        content: 'const value = 1;'
      }
    ]);

    expect(prompt).toContain('診断スコープ: currentFile');
    expect(prompt).toContain('FILE: src/index.ts');
    expect(prompt).toContain('const value = 1;');
  });
});
