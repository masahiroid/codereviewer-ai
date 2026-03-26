import { describe, expect, it } from 'vitest';
import { chunkFiles } from '../src/services/scanService';

describe('scanService', () => {
  it('ファイル群を指定件数で分割する', () => {
    const chunks = chunkFiles([
      { path: 'a.ts', content: 'a' },
      { path: 'b.ts', content: 'b' },
      { path: 'c.ts', content: 'c' }
    ], 2);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.files).toHaveLength(2);
    expect(chunks[1]?.files).toHaveLength(1);
  });
});
