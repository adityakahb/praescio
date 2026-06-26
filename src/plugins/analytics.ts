import type { PraescioPlugin, PraescioPublicAPI } from '../types/Plugin';
import type { SuggestionItem } from '../types/SuggestionItem';

interface AnalyticsOptions {
  /** Called on every debounced query change. */
  onQuery?: (query: string) => void;
  /**
   * Called when the user selects an item.
   * @param item - The selected suggestion.
   * @param query - The query string that was active when the selection happened.
   */
  onSelect?: (item: SuggestionItem, query: string) => void;
  /** Called after a fetch that returns zero results. */
  onNoResults?: (query: string) => void;
}

/**
 * Forwards Praescio interaction events to your analytics pipeline.
 *
 * Tracks queries, item selections, and "no results" scenarios — without
 * requiring you to wire up multiple `instance.on(…)` calls manually.
 *
 * @example
 * ```ts
 * new Praescio('#search', {
 *   source: mySource,
 *   plugins: [
 *     analytics({
 *       onQuery: (q) => gtag('event', 'search', { search_term: q }),
 *       onSelect: (item, q) => gtag('event', 'select_item', { item_name: item.label }),
 *       onNoResults: (q) => gtag('event', 'no_results', { search_term: q }),
 *     }),
 *   ],
 * });
 * ```
 */
export function analytics(opts: AnalyticsOptions): PraescioPlugin {
  return {
    name: 'analytics',
    install(instance: PraescioPublicAPI): void {
      let lastQuery = '';

      if (opts.onQuery) {
        instance.on('query', (query: unknown) => {
          lastQuery = query as string;
          opts.onQuery?.(query as string);
        });
      }

      if (opts.onSelect) {
        instance.on('select', (item: unknown) => {
          opts.onSelect?.(item as SuggestionItem, lastQuery);
        });
      }

      if (opts.onNoResults) {
        instance.on('fetchEnd', (query: unknown, items: unknown) => {
          if (Array.isArray(items) && items.length === 0) {
            opts.onNoResults?.(query as string);
          }
        });
      }
    },
  };
}
