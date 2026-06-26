import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheController } from '../../src/core/data/CacheController';

const items = [{ type: 'text' as const, label: 'Paris' }];

describe('CacheController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null on miss', () => {
    const cache = new CacheController('query', 60_000);
    expect(cache.get('foo')).toBeNull();
  });

  it('returns stored items', () => {
    const cache = new CacheController('query', 60_000);
    cache.set('foo', items);
    expect(cache.get('foo')).toBe(items);
  });

  it('expires entries after TTL', () => {
    const cache = new CacheController('query', 1_000);
    cache.set('foo', items);
    vi.advanceTimersByTime(999);
    expect(cache.get('foo')).toBe(items);
    vi.advanceTimersByTime(2);
    expect(cache.get('foo')).toBeNull();
  });

  it('strategy "none" never stores or returns', () => {
    const cache = new CacheController('none', 60_000);
    cache.set('foo', items);
    expect(cache.get('foo')).toBeNull();
  });

  it('clear removes all entries', () => {
    const cache = new CacheController('query', 60_000);
    cache.set('a', items);
    cache.set('b', items);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });
});
