import { describe, it, expect } from 'vitest';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';

describe('engineUrl', () => {
  it('prepends proxy base to absolute path', () => {
    expect(engineUrl('/data/quotes')).toBe('/api/engine/data/quotes');
  });

  it('prepends proxy base to relative path', () => {
    expect(engineUrl('data/quotes')).toBe('/api/engine/data/quotes');
  });
});

describe('engineHeaders', () => {
  it('returns empty headers (auth handled server-side)', () => {
    expect(engineHeaders()).toEqual({});
  });
});
