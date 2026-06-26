import type { DataSource } from './DataSource';
import type { SuggestionItem } from './SuggestionItem';
import type { PraescioPlugin } from './Plugin';

/**
 * Controls how suggestion results are cached between queries.
 *
 * - `'none'` — no caching; every keystroke triggers a fresh fetch.
 * - `'query'` — exact-match cache keyed by query string; cached results are
 *   returned immediately and no re-fetch is made until the TTL expires.
 * - `'stale-while-revalidate'` — like `'query'` but a fresh fetch is kicked
 *   off in the background while the cached result is shown instantly.
 */
export type CacheStrategy = 'none' | 'query' | 'stale-while-revalidate';

/**
 * Where the suggestion panel appears relative to the anchor input.
 *
 * - `'auto'` — chooses `'bottom'` if there is sufficient space below,
 *   otherwise falls back to `'top'`.
 * - `'bottom'` / `'top'` — always place in the given direction.
 */
export type PanelPlacement = 'bottom' | 'top' | 'auto';

/**
 * Optional HTML slots that customise specific regions of the suggestion panel.
 *
 * Each slot accepts either an HTML string, a static `HTMLElement`, or (for
 * `empty` and `footer`) a factory function that receives the current query.
 */
export interface PraescioSlots {
  /** Content shown when no results match the query (`showEmpty` must be `true`). */
  empty?: string | ((query: string) => HTMLElement);
  /** Content shown while a fetch is in-flight. */
  loading?: string | HTMLElement;
  /** Static content rendered above the item list. */
  header?: string | HTMLElement;
  /** Content rendered below the item list; re-rendered on each result set. */
  footer?: string | ((query: string) => HTMLElement);
}

/**
 * Configuration options for a {@link Praescio} instance.
 *
 * @typeParam T - The raw item type returned by the data source before
 *   any `transform` is applied.
 *
 * @example Minimal
 * ```ts
 * new Praescio('#q', { source: ['Apple', 'Banana', 'Cherry'] });
 * ```
 *
 * @example Full async setup
 * ```ts
 * new Praescio<Product>('#q', {
 *   source: '/api/products?q={query}',
 *   transform: (p) => ({ type: 'rich', label: p.name, description: p.category }),
 *   groupBy: (item) => (item as RichItem).description,
 *   debounce: 200,
 *   minChars: 2,
 *   cache: 'stale-while-revalidate',
 *   onSelect: (item) => router.push(`/products/${item.value}`),
 * });
 * ```
 */
export interface PraescioOptions<T = unknown> {
  // ── Data ──────────────────────────────────────────────────────────────────
  source: DataSource<T>;
  /** Coerce a raw source item into a SuggestionItem */
  transform?: (raw: T) => SuggestionItem;
  /** Return a group label for an item; undefined = no group */
  groupBy?: (item: SuggestionItem) => string | undefined;
  /** Control group ordering; default is insertion order */
  sortGroups?: (a: string, b: string) => number;

  // ── Behaviour ─────────────────────────────────────────────────────────────
  /** Input debounce in ms. Default: 300 */
  debounce?: number;
  /** Minimum characters before a query is issued. Default: 1 */
  minChars?: number;
  /** Max items shown in the panel. Default: 10; 0 = unlimited */
  maxItems?: number;
  /** Cache strategy. Default: 'query' */
  cache?: CacheStrategy;
  /** Cache TTL in ms. Default: 300_000 (5 min) */
  cacheTTL?: number;
  /** Select the highlighted item when Tab is pressed. Default: true */
  selectOnTab?: boolean;
  /** Close the panel after an item is selected. Default: true */
  closeOnSelect?: boolean;
  /** Show cached results when the input is re-focused. Default: false */
  openOnFocus?: boolean;
  /** Wrap matched characters in <mark>. Default: true */
  highlight?: boolean;
  /** Show the empty slot when there are no results. Default: true */
  showEmpty?: boolean;
  /**
   * Enable virtual scrolling.
   * 'auto' enables it automatically when results > 100.
   * Default: 'auto'
   */
  virtualScroll?: boolean | 'auto';

  // ── ContentEditable / @mention mode ───────────────────────────────────────
  /** Trigger character that opens the panel (e.g. '@'). Default: undefined (normal mode) */
  trigger?: string;
  /** What text to insert after selection in @mention mode */
  insertTemplate?: (item: SuggestionItem) => string;

  // ── Panel positioning ─────────────────────────────────────────────────────
  /** Where the panel appears relative to the input. Default: 'auto' */
  placement?: PanelPlacement;
  /** Pixel gap between input edge and panel. Default: 4 */
  offset?: number;
  /** Element the panel is appended to. Default: document.body */
  container?: HTMLElement | string;

  // ── Lifecycle callbacks ───────────────────────────────────────────────────
  onOpen?: () => void;
  onClose?: () => void;
  onSelect?: (item: SuggestionItem, originalEvent: Event) => void;
  onQuery?: (query: string) => void;
  onFetchStart?: (query: string) => void;
  onFetchEnd?: (query: string, items: SuggestionItem[]) => void;
  onFetchError?: (query: string, error: Error) => void;
  /** Called when keyboard navigation highlights a new item. `item` is `null` when highlight clears. */
  onHighlight?: (item: SuggestionItem | null, index: number) => void;
  /** Called when a fetch returns zero results. Useful for "no results" analytics. */
  onEmpty?: (query: string) => void;
  /** Called just before the instance is destroyed. */
  onDestroy?: () => void;

  // ── Slots ─────────────────────────────────────────────────────────────────
  slots?: PraescioSlots;

  // ── Accessibility ─────────────────────────────────────────────────────────
  /** aria-label for the listbox. Default: 'Suggestions' */
  ariaLabel?: string;
  announceResults?: (count: number, query: string) => string;
  announceItem?: (item: SuggestionItem, index: number, total: number) => string;

  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins?: PraescioPlugin[];
}

export type ResolvedOptions<T = unknown> = Required<
  Omit<
    PraescioOptions<T>,
    | 'transform'
    | 'groupBy'
    | 'sortGroups'
    | 'onOpen'
    | 'onClose'
    | 'onSelect'
    | 'onQuery'
    | 'onFetchStart'
    | 'onFetchEnd'
    | 'onFetchError'
    | 'onHighlight'
    | 'onEmpty'
    | 'onDestroy'
    | 'slots'
    | 'announceResults'
    | 'announceItem'
    | 'trigger'
    | 'insertTemplate'
    | 'container'
  >
> &
  Pick<
    PraescioOptions<T>,
    | 'transform'
    | 'groupBy'
    | 'sortGroups'
    | 'onOpen'
    | 'onClose'
    | 'onSelect'
    | 'onQuery'
    | 'onFetchStart'
    | 'onFetchEnd'
    | 'onFetchError'
    | 'onHighlight'
    | 'onEmpty'
    | 'onDestroy'
    | 'slots'
    | 'announceResults'
    | 'announceItem'
    | 'trigger'
    | 'insertTemplate'
    | 'container'
  >;

/**
 * Options that do NOT depend on the source data type T.
 * Used by rendering, a11y, and input subsystems so they can accept
 * ResolvedOptions<T> without TypeScript's function-parameter contravariance
 * complaints about `transform`.
 */
export type CommonOptions = Omit<
  ResolvedOptions<never>,
  'source' | 'transform' | 'groupBy' | 'sortGroups'
>;

export function resolveOptions<T>(opts: PraescioOptions<T>): ResolvedOptions<T> {
  return {
    source: opts.source,
    transform: opts.transform,
    groupBy: opts.groupBy,
    sortGroups: opts.sortGroups,
    debounce: opts.debounce ?? 300,
    minChars: opts.minChars ?? 1,
    maxItems: opts.maxItems ?? 10,
    cache: opts.cache ?? 'query',
    cacheTTL: opts.cacheTTL ?? 300_000,
    selectOnTab: opts.selectOnTab ?? true,
    closeOnSelect: opts.closeOnSelect ?? true,
    openOnFocus: opts.openOnFocus ?? false,
    highlight: opts.highlight ?? true,
    showEmpty: opts.showEmpty ?? true,
    virtualScroll: opts.virtualScroll ?? 'auto',
    placement: opts.placement ?? 'auto',
    offset: opts.offset ?? 4,
    ariaLabel: opts.ariaLabel ?? 'Suggestions',
    plugins: opts.plugins ?? [],
    onOpen: opts.onOpen,
    onClose: opts.onClose,
    onSelect: opts.onSelect,
    onQuery: opts.onQuery,
    onFetchStart: opts.onFetchStart,
    onFetchEnd: opts.onFetchEnd,
    onFetchError: opts.onFetchError,
    onHighlight: opts.onHighlight,
    onEmpty: opts.onEmpty,
    onDestroy: opts.onDestroy,
    slots: opts.slots,
    announceResults: opts.announceResults,
    announceItem: opts.announceItem,
    trigger: opts.trigger,
    insertTemplate: opts.insertTemplate,
    container: opts.container,
  };
}
