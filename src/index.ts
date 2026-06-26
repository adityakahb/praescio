/**
 * @module praescio
 *
 * Praescio — a framework-agnostic TypeScript autocomplete / typeahead library.
 *
 * @example Basic usage
 * ```ts
 * import Praescio from 'praescio';
 * import 'praescio/css';
 *
 * const ac = new Praescio('#search', {
 *   source: ['Apple', 'Banana', 'Cherry'],
 * });
 * ```
 *
 * @example Async source with transform
 * ```ts
 * const ac = new Praescio<{ id: number; name: string }>('#search', {
 *   source: async (query, signal) => {
 *     const res = await fetch(`/api/items?q=${query}`, { signal });
 *     return res.json();
 *   },
 *   transform: (raw) => ({ type: 'text', label: raw.name, value: String(raw.id) }),
 *   onSelect: (item) => console.log('selected', item),
 * });
 * ```
 */
export { Praescio, Praescio as default } from './core/Praescio';

// Types
export type {
  SuggestionItem,
  TextItem,
  DescriptionItem,
  LinkItem,
  IconItem,
  RichItem,
  GroupHeader,
  DividerItem,
  CustomItem,
  SelectableItem,
} from './types/SuggestionItem';
export type {
  PraescioOptions,
  ResolvedOptions,
  CacheStrategy,
  PanelPlacement,
  PraescioSlots,
} from './types/PraescioOptions';
export type { DataSource, DataSourceFn } from './types/DataSource';
export type { PraescioEvents, PraescioEventName, PraescioEventHandler } from './types/Events';
export type { PraescioPlugin, PraescioPublicAPI } from './types/Plugin';

// Bundled plugins
export { recentSearches } from './plugins/recentSearches';
export { fuzzyMatch } from './plugins/fuzzyMatch';
export { keyboardShortcut } from './plugins/keyboardShortcut';
export { analytics } from './plugins/analytics';
