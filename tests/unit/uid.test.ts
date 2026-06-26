import { describe, it, expect } from 'vitest';
import { uid } from '../../src/utils/uid';

describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string');
  });

  it('uses the default prefix "praescio"', () => {
    const id = uid();
    expect(id.startsWith('praescio-')).toBe(true);
  });

  it('uses a custom prefix when provided', () => {
    const id = uid('item');
    expect(id.startsWith('item-')).toBe(true);
  });

  it('each call returns a unique id', () => {
    const ids = new Set(Array.from({ length: 20 }, () => uid()));
    expect(ids.size).toBe(20);
  });

  it('ids are monotonically increasing', () => {
    const a = uid();
    const b = uid();
    const numA = parseInt(a.split('-').pop()!, 10);
    const numB = parseInt(b.split('-').pop()!, 10);
    expect(numB).toBeGreaterThan(numA);
  });
});
