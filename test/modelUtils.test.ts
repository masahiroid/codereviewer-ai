import { describe, expect, it } from 'vitest';
import { filterModels, isDatedModel } from '../src/utils/modelUtils';

describe('modelUtils', () => {
  it('日付付きモデルを判定する', () => {
    expect(isDatedModel('gpt-4.1-2025-01-01')).toBe(true);
    expect(isDatedModel('gpt-4.1')).toBe(false);
  });

  it('日付付きモデルを除外する', () => {
    expect(filterModels(['gpt-4.1', 'gpt-4.1-2025-01-01'], true)).toEqual(['gpt-4.1']);
  });

  it('除外無効時は全件返す', () => {
    expect(filterModels(['gpt-4.1', 'gpt-4.1-2025-01-01'], false)).toEqual(['gpt-4.1', 'gpt-4.1-2025-01-01']);
  });
});
