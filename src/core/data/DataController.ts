/**
 * @fileoverview Data-fetch orchestrator for Praescio.
 *
 * Coordinates the full lifecycle of a suggestion fetch:
 * 1. Checks the {@link CacheController} for a previous result.
 * 2. Issues the request via {@link RequestQueue} (abort-previous on each new query).
 * 3. Transforms raw items using the consumer-supplied `transform` or the
 *    built-in {@link normaliseItems} coercion.
 * 4. Optionally groups results via `groupBy` / `sortGroups`.
 * 5. Caps the result set to `maxItems`.
 * 6. Dispatches the appropriate FSM action to {@link StateManager}.
 *
 * Three cache strategies are supported (see {@link CacheStrategy}):
 * - `'none'` — every query hits the source.
 * - `'query'` — exact-match cache; TTL-based expiry.
 * - `'stale-while-revalidate'` — serve cached result instantly, then re-fetch
 *   in the background to keep the cache fresh.
 */

import type { DataSource, DataSourceFn } from '../../types/DataSource';
import type { SuggestionItem } from '../../types/SuggestionItem';
import type { ResolvedOptions } from '../../types/PraescioOptions';
import { CacheController } from './CacheController';
import { RequestQueue } from './RequestQueue';
import { normaliseItems } from './normalise';
import type { StateManager } from '../state/StateManager';

/**
 * Orchestrates data fetching, caching, and result normalisation for a single
 * Praescio instance.
 *
 * @typeParam T - Raw item type returned by the data source before any
 *   `transform` is applied.
 */
export class DataController<T = unknown> {
  private queue = new RequestQueue();
  private cache: CacheController;
  private stateManager: StateManager;
  private options: ResolvedOptions<T>;
  private maxItems: number;

  // Lazily re-resolved when options.source is patched (e.g. by the fuzzyMatch plugin).
  private _resolvedSource: DataSource<T> | null = null;
  private _sourceFn: DataSourceFn<T> | null = null;

  private get sourceFn(): DataSourceFn<T> {
    if (this.options.source !== this._resolvedSource) {
      this._resolvedSource = this.options.source;
      this._sourceFn = this.resolveSource(this.options.source);
    }
    return this._sourceFn!;
  }

  constructor(stateManager: StateManager, options: ResolvedOptions<T>) {
    this.stateManager = stateManager;
    this.options = options;
    this.maxItems = options.maxItems;
    this.cache = new CacheController(options.cache, options.cacheTTL);
  }

  private resolveSource(source: DataSource<T>): DataSourceFn<T> {
    if (typeof source === 'function') return source as DataSourceFn<T>;

    if (Array.isArray(source)) {
      const items = source as T[];
      return async (query) => {
        const q = query.toLowerCase();
        return items.filter((item) => {
          const label = this.getLabel(item);
          return label.toLowerCase().includes(q);
        });
      };
    }

    if (typeof source === 'string') {
      const urlTemplate = source;
      return async (query, signal) => {
        const url = urlTemplate.replace('{query}', encodeURIComponent(query));
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`Praescio: fetch failed with status ${res.status}`);
        return res.json() as Promise<T[]>;
      };
    }

    throw new Error('Praescio: invalid source type');
  }

  private getLabel(item: T): string {
    if (typeof item === 'string') return item;
    if (item !== null && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      if (typeof o['label'] === 'string') return o['label'];
    }
    return String(item);
  }

  async fetch(query: string): Promise<void> {
    const { options, stateManager, cache, maxItems } = this;

    // Check cache — for SWR, return cached immediately and still fetch
    const cached = cache.get(query);
    if (cached) {
      if (options.cache === 'stale-while-revalidate') {
        const capped = maxItems > 0 ? cached.slice(0, maxItems) : cached;
        stateManager.dispatch(
          capped.length > 0
            ? { type: 'RESULTS_READY', items: capped, query }
            : { type: 'NO_RESULTS', query }
        );
        // Continue to fetch fresh results in background
      } else {
        const capped = maxItems > 0 ? cached.slice(0, maxItems) : cached;
        stateManager.dispatch(
          capped.length > 0
            ? { type: 'RESULTS_READY', items: capped, query }
            : { type: 'NO_RESULTS', query }
        );
        return;
      }
    }

    const { id, signal } = this.queue.start();
    stateManager.dispatch({ type: 'FETCH_START', query });
    options.onFetchStart?.(query);

    try {
      const raw = await this.sourceFn(query, signal);

      if (!this.queue.isCurrent(id)) return;

      let items: SuggestionItem[];
      if (options.transform) {
        items = raw.map(options.transform);
      } else {
        items = normaliseItems(raw);
      }

      // Apply grouping
      if (options.groupBy) {
        items = applyGrouping(items, options.groupBy, options.sortGroups);
      }

      const capped = maxItems > 0 ? items.slice(0, maxItems) : items;
      cache.set(query, capped);

      options.onFetchEnd?.(query, capped);

      stateManager.dispatch(
        capped.length > 0
          ? { type: 'RESULTS_READY', items: capped, query }
          : { type: 'NO_RESULTS', query }
      );
    } catch (err) {
      if (!this.queue.isCurrent(id)) return;
      if ((err as Error).name === 'AbortError') return;
      const error = err instanceof Error ? err : new Error(String(err));
      options.onFetchError?.(query, error);
      stateManager.dispatch({ type: 'FETCH_ERROR', error, query });
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  destroy(): void {
    this.queue.cancelAll();
    this.cache.clear();
  }
}

function applyGrouping(
  items: SuggestionItem[],
  groupBy: (item: SuggestionItem) => string | undefined,
  sortGroups?: (a: string, b: string) => number
): SuggestionItem[] {
  const groups = new Map<string, SuggestionItem[]>();
  const ungrouped: SuggestionItem[] = [];

  for (const item of items) {
    const key = groupBy(item);
    if (key === undefined) {
      ungrouped.push(item);
    } else {
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        groups.set(key, [item]);
      }
    }
  }

  const keys = [...groups.keys()];
  if (sortGroups) keys.sort(sortGroups);

  const result: SuggestionItem[] = [...ungrouped];
  for (const key of keys) {
    result.push({ type: 'group', label: key });
    result.push(...(groups.get(key) ?? []));
  }
  return result;
}
