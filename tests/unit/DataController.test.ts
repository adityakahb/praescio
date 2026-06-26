/**
 * @fileoverview Unit tests for {@link DataController}.
 *
 * Covers all source types (array, URL template, function), caching strategies
 * ('none', 'query', 'stale-while-revalidate'), transform, groupBy/sortGroups,
 * error paths, and the clearCache / destroy lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataController } from '../../src/core/data/DataController';
import { StateManager } from '../../src/core/state/StateManager';
import { resolveOptions } from '../../src/types/PraescioOptions';
import type { SuggestionItem } from '../../src/types/SuggestionItem';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeController<T = unknown>(
  overrides: Partial<Parameters<typeof resolveOptions>[0]> = {}
): { ctrl: DataController<T>; sm: StateManager } {
  const sm = new StateManager();
  const opts = resolveOptions<T>({
    source: [] as T[],
    cache: 'none',
    maxItems: 0,
    debounce: 0,
    minChars: 0,
    ...overrides,
  });
  const ctrl = new DataController<T>(sm, opts);
  return { ctrl, sm };
}

// ── Array source ───────────────────────────────────────────────────────────────

describe('DataController — array source', () => {
  it('returns items whose labels match the query (case-insensitive)', async () => {
    const { ctrl, sm } = makeController({ source: ['Apple', 'Apricot', 'Banana'] });
    await ctrl.fetch('ap');
    const { items, status } = sm.getState();
    expect(status).toBe('open');
    expect(items.map((i) => i.label)).toEqual(['Apple', 'Apricot']);
  });

  it('dispatches NO_RESULTS when no items match', async () => {
    const { ctrl, sm } = makeController({ source: ['Cat', 'Dog'] });
    await ctrl.fetch('xyz');
    expect(sm.getState().status).toBe('empty');
  });

  it('returns all items when query is empty string', async () => {
    const source = ['One', 'Two', 'Three'];
    const { ctrl, sm } = makeController({ source });
    await ctrl.fetch('');
    expect(sm.getState().items).toHaveLength(3);
  });

  it('respects the maxItems cap', async () => {
    const source = ['Alpha', 'Aleph', 'Albatross', 'Alert', 'Alarm'];
    const { ctrl, sm } = makeController({ source, maxItems: 3 });
    await ctrl.fetch('al');
    expect(sm.getState().items).toHaveLength(3);
  });

  it('filters by object label field', async () => {
    type Item = { label: string; value: string };
    const source: Item[] = [
      { label: 'React', value: 'react' },
      { label: 'Vue', value: 'vue' },
      { label: 'Reactive', value: 'reactive' },
    ];
    const { ctrl, sm } = makeController<Item>({ source });
    await ctrl.fetch('react');
    expect(sm.getState().items).toHaveLength(2);
  });
});

// ── Function source ────────────────────────────────────────────────────────────

describe('DataController — function source', () => {
  it('calls the function with the query and signal', async () => {
    const sourceFn = vi.fn(async (_q: string, _s: AbortSignal) => ['Result A', 'Result B']);
    const { ctrl, sm } = makeController({ source: sourceFn });
    await ctrl.fetch('q');
    expect(sourceFn).toHaveBeenCalledWith('q', expect.any(AbortSignal));
    expect(sm.getState().status).toBe('open');
    expect(sm.getState().items).toHaveLength(2);
  });

  it('calls onFetchStart and onFetchEnd callbacks', async () => {
    const onFetchStart = vi.fn();
    const onFetchEnd = vi.fn();
    const { ctrl } = makeController({
      source: async () => ['A'],
      onFetchStart,
      onFetchEnd,
    });
    await ctrl.fetch('test');
    expect(onFetchStart).toHaveBeenCalledWith('test');
    expect(onFetchEnd).toHaveBeenCalledWith('test', expect.any(Array));
  });
});

// ── URL template source ────────────────────────────────────────────────────────

describe('DataController — URL template source', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(['Remote A', 'Remote B']),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('replaces {query} in the URL and fetches', async () => {
    const { ctrl, sm } = makeController({ source: '/api/search?q={query}' });
    await ctrl.fetch('hello world');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/search?q=hello%20world',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(sm.getState().status).toBe('open');
    expect(sm.getState().items).toHaveLength(2);
  });

  it('dispatches FETCH_ERROR when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 }))
    );
    const onFetchError = vi.fn();
    const { ctrl, sm } = makeController({ source: '/api/search?q={query}', onFetchError });
    await ctrl.fetch('q');
    expect(sm.getState().status).toBe('error');
    expect(onFetchError).toHaveBeenCalled();
  });

  it('dispatches FETCH_ERROR on invalid source type', async () => {
    // Source type validation is lazy — it runs when the first fetch is issued.
    const { ctrl, sm } = makeController({ source: 42 as unknown as string[] });
    await ctrl.fetch('q');
    expect(sm.getState().status).toBe('error');
  });
});

// ── Error handling ─────────────────────────────────────────────────────────────

describe('DataController — error handling', () => {
  it('dispatches FETCH_ERROR when the function rejects', async () => {
    const onFetchError = vi.fn();
    const { ctrl, sm } = makeController({
      source: async () => {
        throw new Error('network error');
      },
      onFetchError,
    });
    await ctrl.fetch('q');
    expect(sm.getState().status).toBe('error');
    expect(onFetchError).toHaveBeenCalledWith('q', expect.any(Error));
  });

  it('does not dispatch FETCH_ERROR when the request is aborted', async () => {
    const onFetchError = vi.fn();
    const { ctrl, sm } = makeController({
      source: async (_q, signal) => {
        // Wait for a tick — allows abort to be triggered in a follow-up call
        await new Promise((r) => setTimeout(r, 0));
        if (signal.aborted) {
          const e = new DOMException('aborted', 'AbortError');
          throw e;
        }
        return [];
      },
      onFetchError,
    });
    // Start first fetch but immediately start second to abort it
    const p1 = ctrl.fetch('q1');
    const p2 = ctrl.fetch('q2');
    await Promise.all([p1, p2]);
    // onFetchError should NOT have been called for the aborted request
    expect(onFetchError).not.toHaveBeenCalled();
    // Final state belongs to the second fetch
    expect(sm.getState().query).toBe('q2');
  });
});

// ── Transform ─────────────────────────────────────────────────────────────────

describe('DataController — transform', () => {
  it('applies the transform function to each raw item', async () => {
    type Raw = { id: number; name: string };
    const source: Raw[] = [
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
    ];
    const transform = (r: Raw): SuggestionItem => ({
      type: 'text',
      label: r.name,
      value: String(r.id),
    });
    const { sm } = makeController<Raw>({ source, transform });
    // Use a function source so all items come back (array source filters by label)
    const fnCtrl = new DataController<Raw>(sm, {
      ...resolveOptions<Raw>({ source: async () => source, transform, cache: 'none' }),
    });
    await fnCtrl.fetch('');
    const { items } = sm.getState();
    expect(items[0]).toEqual({ type: 'text', label: 'One', value: '1' });
    expect(items[1]).toEqual({ type: 'text', label: 'Two', value: '2' });
  });
});

// ── groupBy / sortGroups ───────────────────────────────────────────────────────

describe('DataController — groupBy', () => {
  it('inserts GroupHeader nodes before each group', async () => {
    const source = async (): Promise<SuggestionItem[]> => [
      { type: 'text', label: 'React', meta: { framework: 'js' } },
      { type: 'text', label: 'Rails', meta: { framework: 'ruby' } },
      { type: 'text', label: 'Angular', meta: { framework: 'js' } },
    ];

    const { ctrl, sm } = makeController({
      source,
      groupBy: (item) => (item.meta as Record<string, string> | undefined)?.['framework'],
      cache: 'none' as const,
    });
    await ctrl.fetch('');
    const { items } = sm.getState();
    const groupHeaders = items.filter((i) => i.type === 'group');
    expect(groupHeaders).toHaveLength(2);
  });

  it('respects sortGroups comparator', async () => {
    const source = async (): Promise<SuggestionItem[]> => [
      { type: 'text', label: 'B item', meta: { g: 'B' } },
      { type: 'text', label: 'A item', meta: { g: 'A' } },
    ];

    const { ctrl, sm } = makeController({
      source,
      groupBy: (item) => (item.meta as Record<string, string> | undefined)?.['g'],
      sortGroups: (a, b) => a.localeCompare(b),
      cache: 'none' as const,
    });
    await ctrl.fetch('');
    const { items } = sm.getState();
    // First group header should be 'A'
    const firstHeader = items.find((i) => i.type === 'group');
    expect(firstHeader?.label).toBe('A');
  });

  it('places ungrouped items at the start', async () => {
    const source = async (): Promise<SuggestionItem[]> => [
      { type: 'text', label: 'No group' },
      { type: 'text', label: 'In group', meta: { g: 'grp' } },
    ];

    const { ctrl, sm } = makeController({
      source,
      groupBy: (item) => (item.meta as Record<string, string> | undefined)?.['g'],
      cache: 'none' as const,
    });
    await ctrl.fetch('');
    const { items } = sm.getState();
    expect(items[0].label).toBe('No group');
  });
});

// ── Cache strategy: 'query' ────────────────────────────────────────────────────

describe("DataController — cache: 'query'", () => {
  it('returns cached results without re-calling the source', async () => {
    const sourceFn = vi.fn(async () => ['Cached']);
    const { ctrl } = makeController({ source: sourceFn, cache: 'query', cacheTTL: 60_000 });
    await ctrl.fetch('q');
    await ctrl.fetch('q');
    // Source should only have been invoked once
    expect(sourceFn).toHaveBeenCalledTimes(1);
  });
});

// ── Cache strategy: 'stale-while-revalidate' ──────────────────────────────────

describe("DataController — cache: 'stale-while-revalidate'", () => {
  it('shows cached result immediately and still calls the source again', async () => {
    let callCount = 0;
    const sourceFn = vi.fn(async () => {
      callCount++;
      return ['Item ' + callCount];
    });
    const { ctrl, sm } = makeController({
      source: sourceFn,
      cache: 'stale-while-revalidate',
      cacheTTL: 60_000,
    });
    await ctrl.fetch('q');
    // First call — nothing cached yet, source called once
    expect(sourceFn).toHaveBeenCalledTimes(1);
    expect(sm.getState().items[0].label).toBe('Item 1');

    await ctrl.fetch('q');
    // Second call — cached value shown immediately AND source re-called
    expect(sourceFn).toHaveBeenCalledTimes(2);
  });
});

// ── clearCache / destroy ───────────────────────────────────────────────────────

describe('DataController — clearCache', () => {
  it('evicts cached entries so the source is called again', async () => {
    const sourceFn = vi.fn(async () => ['A']);
    const { ctrl } = makeController({ source: sourceFn, cache: 'query', cacheTTL: 60_000 });
    await ctrl.fetch('q');
    ctrl.clearCache();
    await ctrl.fetch('q');
    expect(sourceFn).toHaveBeenCalledTimes(2);
  });
});

describe('DataController — destroy', () => {
  it('does not throw when called', () => {
    const { ctrl } = makeController({ source: async () => [] });
    expect(() => ctrl.destroy()).not.toThrow();
  });

  it('cancels in-flight requests so late results do not open the panel', async () => {
    let resolve!: (v: string[]) => void;
    const sourceFn = vi.fn(() => new Promise<string[]>((res) => (resolve = res)));
    const { ctrl, sm } = makeController({ source: sourceFn });
    const fetchPromise = ctrl.fetch('q');
    // destroy() calls cancelAll() on the queue, making isCurrent() return false
    ctrl.destroy();
    resolve(['Late result']);
    await fetchPromise;
    // The state was set to 'loading' by FETCH_START but must NOT advance to 'open'
    expect(sm.getState().status).not.toBe('open');
    expect(sm.getState().items).toHaveLength(0);
  });
});
