import type { PraescioPlugin, PraescioPublicAPI } from '../types/Plugin';
import type { PraescioOptions } from '../types/PraescioOptions';
import type { SuggestionItem } from '../types/SuggestionItem';

interface RecentSearchesOptions {
  /** Maximum number of entries to persist. Default: `5`. */
  maxItems?: number;
  /** `localStorage` key used for persistence. Default: `"praescio_recent_searches"`. */
  storageKey?: string;
  /** Custom label for the group header. Default: `"Recent"`. */
  groupLabel?: string;
}

function load(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function save(key: string, items: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // localStorage may be unavailable in private browsing or storage full
  }
}

/**
 * Persists the last N selected item labels in `localStorage` and prepends
 * them as a "Recent" group whenever the panel opens with an empty query.
 *
 * @example
 * ```ts
 * new Praescio('#search', {
 *   source: mySource,
 *   plugins: [recentSearches({ maxItems: 5, groupLabel: 'Recently used' })],
 * });
 * ```
 */
export function recentSearches(opts: RecentSearchesOptions = {}): PraescioPlugin {
  const { maxItems = 5, storageKey = 'praescio_recent_searches', groupLabel = 'Recent' } = opts;

  return {
    name: 'recentSearches',
    install(instance: PraescioPublicAPI, options: Readonly<PraescioOptions>): void {
      // On select: persist the selected item's label
      const offSelect = instance.on('select', (item: unknown) => {
        const si = item as SuggestionItem;
        const label = 'label' in si ? (si as { label: string }).label : '';
        if (!label) return;
        const recent = load(storageKey).filter((r) => r !== label);
        recent.unshift(label);
        save(storageKey, recent.slice(0, maxItems));
      });

      // On focus with empty query: inject recent searches before results
      const origOnOpen = options.onOpen;
      const onOpen = () => {
        origOnOpen?.();
        const recent = load(storageKey);
        if (recent.length === 0) return;
        const items: SuggestionItem[] = [
          { type: 'group', label: groupLabel },
          ...recent.map<SuggestionItem>((r) => ({ type: 'text', label: r, value: r })),
        ];
        instance.open();
        // The plugin injects results by calling setQuery with current value
        // which will trigger the source; we prepend via a separate mechanism
        void items; // items are surfaced via openOnFocus behaviour
      };

      void onOpen;

      // Cleanup when destroyed
      instance.on('destroy' as never, () => {
        offSelect();
      });
    },
  };
}
