import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from '../../src/plugins/fuzzyMatch';
import type { PraescioOptions } from '../../src/types/PraescioOptions';

function makeOptions(source: unknown): Readonly<PraescioOptions> {
  return { source } as unknown as Readonly<PraescioOptions>;
}

// ── fuzzyMatch plugin ─────────────────────────────────────────────────────────

describe('fuzzyMatch — plugin metadata', () => {
  it('has name "fuzzyMatch"', () => {
    expect(fuzzyMatch().name).toBe('fuzzyMatch');
  });
});

describe('fuzzyMatch — array source wrapping', () => {
  it('replaces an array source with a fuzzy-filtered function', async () => {
    const opts = makeOptions(['TypeScript', 'JavaScript', 'Python']);
    fuzzyMatch().install({} as never, opts);
    const fn = (opts as Record<string, unknown>)['source'] as (q: string) => Promise<unknown[]>;
    const results = await fn('Typscript');
    expect(Array.isArray(results)).toBe(true);
  });

  it('returns exact matches within threshold', async () => {
    const opts = makeOptions(['TypeScript', 'JavaScript', 'Python']);
    fuzzyMatch({ threshold: 2 }).install({} as never, opts);
    const fn = (opts as Record<string, unknown>)['source'] as (q: string) => Promise<string[]>;
    const results = await fn('TypeScript');
    expect(results).toContain('TypeScript');
  });

  it('excludes items beyond the edit distance threshold', async () => {
    const opts = makeOptions(['TypeScript', 'JavaScript', 'Python']);
    fuzzyMatch({ threshold: 1 }).install({} as never, opts);
    const fn = (opts as Record<string, unknown>)['source'] as (q: string) => Promise<string[]>;
    const results = await fn('Go');
    expect(results).not.toContain('TypeScript');
  });

  it('sorts results by ascending edit distance', async () => {
    const opts = makeOptions(['React', 'Reect', 'Reeeact']);
    fuzzyMatch({ threshold: 3 }).install({} as never, opts);
    const fn = (opts as Record<string, unknown>)['source'] as (q: string) => Promise<string[]>;
    const results = await fn('React');
    expect((results as string[])[0]).toBe('React');
  });

  it('handles object items with label property', async () => {
    const items = [{ label: 'TypeScript' }, { label: 'JavaScript' }];
    const opts = makeOptions(items);
    fuzzyMatch({ threshold: 2 }).install({} as never, opts);
    const fn = (opts as Record<string, unknown>)['source'] as (q: string) => Promise<unknown[]>;
    const results = await fn('TypeScript');
    expect(results.length).toBeGreaterThan(0);
  });

  it('does nothing when source is not an array or function', () => {
    const opts = makeOptions(null);
    expect(() => fuzzyMatch().install({} as never, opts)).not.toThrow();
    expect((opts as Record<string, unknown>)['source']).toBeNull();
  });
});
