import { describe, it, expect } from 'vitest';
import { RequestQueue } from '../../src/core/data/RequestQueue';

describe('RequestQueue', () => {
  it('isCurrent returns true for the latest request', () => {
    const q = new RequestQueue();
    const { id } = q.start();
    expect(q.isCurrent(id)).toBe(true);
  });

  it('isCurrent returns false for a stale request', () => {
    const q = new RequestQueue();
    const { id: first } = q.start();
    q.start(); // second request supersedes first
    expect(q.isCurrent(first)).toBe(false);
  });

  it('previous signal is aborted when new request starts', () => {
    const q = new RequestQueue();
    const { signal: first } = q.start();
    q.start();
    expect(first.aborted).toBe(true);
  });

  it('cancelAll aborts the current request', () => {
    const q = new RequestQueue();
    const { signal, id } = q.start();
    q.cancelAll();
    expect(signal.aborted).toBe(true);
    expect(q.isCurrent(id)).toBe(false);
  });

  it('each start() returns a unique id', () => {
    const q = new RequestQueue();
    const ids = [q.start().id, q.start().id, q.start().id];
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });
});
