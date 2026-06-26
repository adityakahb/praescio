/**
 * Async function that resolves suggestions for a given query.
 *
 * @param query - The current input string.
 * @param signal - An {@link AbortSignal} that fires when the request is
 *   superseded by a newer query; pass it to `fetch` to cancel in-flight requests.
 * @returns A promise that resolves to an array of raw items.
 *
 * @example
 * ```ts
 * const source: DataSourceFn<Product> = async (query, signal) => {
 *   const res = await fetch(`/api/products?q=${query}`, { signal });
 *   return res.json();
 * };
 * ```
 */
type DataSourceFn<T> = (query: string, signal: AbortSignal) => Promise<T[]>;
/**
 * Flexible data source accepted by Praescio.
 *
 * Three forms are supported:
 * - **Array** – filtered in memory using a case-insensitive substring match on
 *   `item.label` (or the string value for plain-string arrays).
 * - **Function** – {@link DataSourceFn}; full control over fetching and filtering.
 * - **URL string** – a URL template containing `{query}` which is replaced with
 *   the percent-encoded query and fetched via `fetch`. The response must be a
 *   JSON array.
 *
 * @example Array source
 * ```ts
 * source: ['Apple', 'Banana', 'Cherry']
 * ```
 *
 * @example URL template
 * ```ts
 * source: 'https://api.example.com/search?q={query}'
 * ```
 */
type DataSource<T> = T[] | DataSourceFn<T> | string;

/**
 * A plain-text suggestion — the simplest item type.
 *
 * @example
 * ```ts
 * { type: 'text', label: 'Apple', value: 'apple' }
 * ```
 */
interface TextItem {
    type: 'text';
    /** Display label shown in the panel. */
    label: string;
    /** Value written to the input on selection. Defaults to `label` when omitted. */
    value?: string;
    /** Arbitrary extra data carried along for use in event handlers. */
    meta?: Record<string, unknown>;
}
/**
 * A suggestion with a secondary description line below the label.
 *
 * @example
 * ```ts
 * { type: 'description', label: 'TypeScript', description: 'Typed JavaScript at any scale' }
 * ```
 */
interface DescriptionItem {
    type: 'description';
    label: string;
    /** Supplementary text rendered below the label. */
    description: string;
    value?: string;
    meta?: Record<string, unknown>;
}
/**
 * A suggestion that navigates to a URL on selection.
 *
 * The item is rendered as an `<a>` element. On **click** the browser follows
 * `href` naturally; the panel is closed and the `select` event fires, but the
 * input value is **not** changed. On **keyboard Enter** the navigation is
 * triggered programmatically via `window.location` (or `window.open` for
 * `target: '_blank'`).
 *
 * `href` values are sanitized at render time — `javascript:` and `vbscript:`
 * URIs are replaced with `'#'`.
 *
 * @example
 * ```ts
 * { type: 'link', label: 'GitHub', href: 'https://github.com', target: '_blank' }
 * ```
 */
interface LinkItem {
    type: 'link';
    label: string;
    /** Navigation target URL. Sanitized at render time to block `javascript:` URIs. */
    href: string;
    /** Link target attribute. Defaults to `_self`. */
    target?: '_self' | '_blank';
    description?: string;
    meta?: Record<string, unknown>;
}
/**
 * A suggestion with a leading icon.
 *
 * @example SVG icon
 * ```ts
 * { type: 'icon', label: 'Settings', icon: '<svg>…</svg>' }
 * ```
 *
 * @example Icon font class
 * ```ts
 * { type: 'icon', label: 'Home', icon: 'fa fa-home', iconAlt: 'home icon' }
 * ```
 */
interface IconItem {
    type: 'icon';
    label: string;
    /** SVG string, absolute/relative URL, or icon-font class. */
    icon: string;
    /** Omit for decorative icons; provide for meaningful icons. */
    iconAlt?: string;
    value?: string;
    meta?: Record<string, unknown>;
}
/**
 * A rich suggestion combining icon, label, description, badge, and optional link.
 *
 * This is the most versatile item type — use it for search-result cards,
 * command-palette entries, or user lookup results.
 *
 * @example
 * ```ts
 * {
 *   type: 'rich',
 *   label: 'John Doe',
 *   description: 'Engineering · San Francisco',
 *   icon: '/avatars/john.jpg',
 *   badge: 'Admin',
 *   value: 'john.doe',
 * }
 * ```
 */
interface RichItem {
    type: 'rich';
    label: string;
    description?: string;
    href?: string;
    target?: '_self' | '_blank';
    icon?: string;
    iconAlt?: string;
    /** Small badge label rendered to the right of the icon. */
    badge?: string;
    value?: string;
    meta?: Record<string, unknown>;
}
/**
 * A non-selectable group header rendered between items.
 * Injected automatically by the `groupBy` option, or supplied manually.
 *
 * @example
 * ```ts
 * { type: 'group', label: 'Recent' }
 * ```
 */
interface GroupHeader {
    type: 'group';
    label: string;
    icon?: string;
    collapsible?: boolean;
}
/**
 * A visual divider line between items or groups. Non-selectable.
 *
 * @example
 * ```ts
 * { type: 'divider' }
 * ```
 */
interface DividerItem {
    type: 'divider';
}
/**
 * A fully custom item rendered by user-supplied code or raw HTML markup.
 *
 * Two rendering modes are supported:
 *
 * **`render` callback** — receives the container element and the current
 * query string; ideal for dynamic content or when cleanup is needed.
 * Return a cleanup function to release resources when the item is removed.
 *
 * **`html` string** — set directly as `innerHTML` when no `render` is
 * provided. Allows images, formatted text, or any inline markup.
 * **The caller is responsible for sanitizing this value** — never pass
 * unescaped user input here.
 *
 * `render` takes precedence over `html` when both are present.
 *
 * @example Render callback
 * ```ts
 * {
 *   type: 'custom',
 *   label: 'Create "react"',
 *   render(container, query) {
 *     container.innerHTML = `<strong>+ Create "${query}"</strong>`;
 *   },
 * }
 * ```
 *
 * @example HTML markup (image + text)
 * ```ts
 * {
 *   type: 'custom',
 *   label: 'Acme Corp',
 *   html: '<img src="/logos/acme.png" alt=""> <span>Acme Corp</span>',
 * }
 * ```
 */
interface CustomItem {
    type: 'custom';
    /**
     * Called with the container element and the current query string.
     * Takes precedence over `html`. May return a cleanup function that is
     * called before the item is removed from the DOM.
     */
    render?: (container: HTMLElement, query: string) => void | (() => void);
    /**
     * Raw HTML string rendered as the item's inner markup.
     * Used only when `render` is not provided.
     * **Caller is responsible for sanitization — do not interpolate raw user input.**
     */
    html?: string;
    /** Used for screen reader announcements even with custom rendering. */
    label: string;
    value?: string;
    meta?: Record<string, unknown>;
}
/**
 * Union of all item types that can appear in the suggestion panel.
 * Use the `type` discriminant to narrow to a specific shape.
 */
type SuggestionItem = TextItem | DescriptionItem | LinkItem | IconItem | RichItem | GroupHeader | DividerItem | CustomItem;
/** Items that a user can actually select (excludes structural `group` and `divider`). */
type SelectableItem = Exclude<SuggestionItem, GroupHeader | DividerItem>;

/**
 * Interface every Praescio plugin must implement.
 *
 * A plugin is a plain object with a unique `name` and an `install` method that
 * is called once during {@link Praescio} construction, after all core
 * sub-systems are wired up.
 *
 * @example Minimal plugin
 * ```ts
 * const logPlugin: PraescioPlugin = {
 *   name: 'logger',
 *   install(instance) {
 *     instance.on('select', (item) => console.log('[praescio] selected', item));
 *   },
 * };
 *
 * new Praescio('#search', { source: [...], plugins: [logPlugin] });
 * ```
 */
interface PraescioPlugin {
    /** Unique identifier; used for deduplication and debugging. */
    name: string;
    /**
     * Called once when the plugin is registered.
     * @param instance - The public API of the Praescio instance.
     * @param options - The resolved (merged-with-defaults) options object.
     *   Plugins may mutate `options` to wrap the data source or override
     *   callbacks (see {@link fuzzyMatch} for an example).
     */
    install(instance: PraescioPublicAPI, options: Readonly<PraescioOptions<any>>): void;
}
/**
 * Subset of the Praescio instance surface exposed to plugins and external consumers.
 *
 * Using this narrower interface (instead of the full `Praescio` class) keeps
 * plugins decoupled from internal implementation details.
 */
interface PraescioPublicAPI {
    /** Programmatically open the panel, optionally for a specific query. */
    open(query?: string): void;
    /** Programmatically close the panel. */
    close(): void;
    /**
     * Set the input value and optionally trigger a data fetch.
     * @param value - New input value.
     * @param triggerFetch - When `true` (default) a fetch is issued if
     *   `value.length >= minChars`.
     */
    setQuery(value: string, triggerFetch?: boolean): void;
    /** Re-fetch using the current query (useful to invalidate stale results). */
    refresh(): void;
    /** Clear the in-memory query cache. */
    clearCache(): void;
    /** Tear down the instance and remove all DOM / event-listener side-effects. */
    destroy(): void;
    /**
     * Subscribe to an event.
     * @returns An unsubscribe function.
     */
    on(event: string, handler: (...args: unknown[]) => void): () => void;
    /** Remove a previously registered event handler. */
    off(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Controls how suggestion results are cached between queries.
 *
 * - `'none'` — no caching; every keystroke triggers a fresh fetch.
 * - `'query'` — exact-match cache keyed by query string; cached results are
 *   returned immediately and no re-fetch is made until the TTL expires.
 * - `'stale-while-revalidate'` — like `'query'` but a fresh fetch is kicked
 *   off in the background while the cached result is shown instantly.
 */
type CacheStrategy = 'none' | 'query' | 'stale-while-revalidate';
/**
 * Where the suggestion panel appears relative to the anchor input.
 *
 * - `'auto'` — chooses `'bottom'` if there is sufficient space below,
 *   otherwise falls back to `'top'`.
 * - `'bottom'` / `'top'` — always place in the given direction.
 */
type PanelPlacement = 'bottom' | 'top' | 'auto';
/**
 * Optional HTML slots that customise specific regions of the suggestion panel.
 *
 * Each slot accepts either an HTML string, a static `HTMLElement`, or (for
 * `empty` and `footer`) a factory function that receives the current query.
 */
interface PraescioSlots {
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
interface PraescioOptions<T = unknown> {
    source: DataSource<T>;
    /** Coerce a raw source item into a SuggestionItem */
    transform?: (raw: T) => SuggestionItem;
    /** Return a group label for an item; undefined = no group */
    groupBy?: (item: SuggestionItem) => string | undefined;
    /** Control group ordering; default is insertion order */
    sortGroups?: (a: string, b: string) => number;
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
    /** Trigger character that opens the panel (e.g. '@'). Default: undefined (normal mode) */
    trigger?: string;
    /** What text to insert after selection in @mention mode */
    insertTemplate?: (item: SuggestionItem) => string;
    /** Where the panel appears relative to the input. Default: 'auto' */
    placement?: PanelPlacement;
    /** Pixel gap between input edge and panel. Default: 4 */
    offset?: number;
    /** Element the panel is appended to. Default: document.body */
    container?: HTMLElement | string;
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
    slots?: PraescioSlots;
    /** aria-label for the listbox. Default: 'Suggestions' */
    ariaLabel?: string;
    announceResults?: (count: number, query: string) => string;
    announceItem?: (item: SuggestionItem, index: number, total: number) => string;
    plugins?: PraescioPlugin[];
}
type ResolvedOptions<T = unknown> = Required<Omit<PraescioOptions<T>, 'transform' | 'groupBy' | 'sortGroups' | 'onOpen' | 'onClose' | 'onSelect' | 'onQuery' | 'onFetchStart' | 'onFetchEnd' | 'onFetchError' | 'onHighlight' | 'onEmpty' | 'onDestroy' | 'slots' | 'announceResults' | 'announceItem' | 'trigger' | 'insertTemplate' | 'container'>> & Pick<PraescioOptions<T>, 'transform' | 'groupBy' | 'sortGroups' | 'onOpen' | 'onClose' | 'onSelect' | 'onQuery' | 'onFetchStart' | 'onFetchEnd' | 'onFetchError' | 'onHighlight' | 'onEmpty' | 'onDestroy' | 'slots' | 'announceResults' | 'announceItem' | 'trigger' | 'insertTemplate' | 'container'>;

/**
 * All events emitted by a Praescio instance.
 *
 * Subscribe via {@link Praescio.on}:
 * ```ts
 * ac.on('select', (item, event) => console.log(item.label));
 * ac.on('highlight', (item, index) => previewItem(item));
 * ac.on('empty', (query) => logNoResults(query));
 * ac.on('fetchError', (query, err) => reportError(err));
 * ```
 */
interface PraescioEvents {
    /** Fired when the suggestion panel opens. */
    open: () => void;
    /** Fired when the suggestion panel closes. */
    close: () => void;
    /**
     * Fired when the user selects an item (click or keyboard Enter/Tab).
     * @param item - The selected {@link SuggestionItem}.
     * @param originalEvent - The DOM event that triggered the selection.
     */
    select: (item: SuggestionItem, originalEvent: Event) => void;
    /**
     * Fired on every debounced input change (after `minChars` is reached).
     * @param query - The current input value.
     */
    query: (query: string) => void;
    /**
     * Fired immediately before a data fetch begins.
     * @param query - The query string being fetched.
     */
    fetchStart: (query: string) => void;
    /**
     * Fired when a data fetch completes successfully.
     * @param query - The query that was fetched.
     * @param items - The resolved (and optionally transformed) suggestion list.
     */
    fetchEnd: (query: string, items: SuggestionItem[]) => void;
    /**
     * Fired when a data fetch throws an error (excluding AbortErrors).
     * @param query - The query that failed.
     * @param error - The error that was thrown.
     */
    fetchError: (query: string, error: Error) => void;
    /**
     * Fired when keyboard navigation moves the highlight to a new item.
     * Also fires with `index = -1` when the highlight is cleared (e.g. on Escape).
     *
     * @param item - The newly highlighted item, or `null` when highlight is cleared.
     * @param index - Zero-based index of the highlighted item among selectable items.
     *   `-1` means no item is highlighted.
     */
    highlight: (item: SuggestionItem | null, index: number) => void;
    /**
     * Fired when a fetch completes and returns zero results for a query.
     * Useful for analytics ("no results" tracking) and showing contextual UI.
     *
     * @param query - The query that produced no results.
     */
    empty: (query: string) => void;
    /**
     * Fired immediately before the instance is torn down by {@link Praescio.destroy}.
     * Plugins should use this to clean up any side-effects they introduced.
     */
    destroy: () => void;
}
/** Union of all event names. */
type PraescioEventName = keyof PraescioEvents;
/** Infers the correct handler signature for a given event name. */
type PraescioEventHandler<K extends PraescioEventName> = PraescioEvents[K];

/**
 * The main Praescio autocomplete/typeahead controller.
 *
 * Attach it to any `<input>` or `contenteditable` element and supply a data
 * source; Praescio handles debouncing, caching, keyboard navigation,
 * accessibility (ARIA combobox pattern), and rendering.
 *
 * @typeParam T - Type of the raw items returned by the data source, before
 *   any `transform` is applied.
 *
 * @example Static array source
 * ```ts
 * import Praescio from 'praescio';
 * import 'praescio/css';
 *
 * const ac = new Praescio('#city-input', {
 *   source: ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin'],
 *   onSelect: (item) => console.log('chosen:', item.label),
 * });
 * ```
 *
 * @example Async REST source with custom transform
 * ```ts
 * interface User { id: number; login: string; avatar_url: string }
 *
 * const ac = new Praescio<User>('#user-search', {
 *   source: async (query, signal) => {
 *     const res = await fetch(`/api/users?q=${query}`, { signal });
 *     return res.json();
 *   },
 *   transform: (u) => ({
 *     type: 'rich',
 *     label: u.login,
 *     icon: u.avatar_url,
 *     value: String(u.id),
 *   }),
 *   debounce: 200,
 *   minChars: 2,
 *   plugins: [keyboardShortcut({ key: 'k' })],
 * });
 * ```
 */
declare class Praescio<T = unknown> implements PraescioPublicAPI {
    /** Library version string. Consumers can read this without instantiating. */
    static readonly currentVersion = "1.0.0";
    private inputEl;
    private options;
    private instanceId;
    private stateManager;
    private dataController;
    private inputController;
    private contentEditableCtrl;
    private listRenderer;
    private panelManager;
    private a11yController;
    private keyboardHandler;
    private liveRegion;
    private pluginRegistry;
    private emitter;
    private unsubscribeState;
    private outsideClickCleanup;
    private listClickCleanup;
    private panelPointerdownCleanup;
    private destroyed;
    /**
     * Create a new Praescio autocomplete instance.
     *
     * @param target - A CSS selector string or a direct `HTMLElement` reference
     *   for the input that will be enhanced.
     * @param options - Configuration; see {@link PraescioOptions} for the full
     *   reference. The only required field is `source`.
     * @throws {Error} If `target` is a string that matches no element in the DOM.
     */
    constructor(target: string | HTMLElement, options: PraescioOptions<T>);
    private resolveContainer;
    /**
     * Called by `InputController` after debounce with the already-trimmed query.
     * Fires the `query` event and delegates to `DataController` when the query
     * meets the `minChars` threshold.
     */
    private onQueryReady;
    /**
     * Handle a click on a list item.
     *
     * Uses event delegation: finds the closest `[role="option"]` ancestor of the
     * clicked target, maps it to a `SuggestionItem`, then either navigates (link
     * items) or calls `selectItem` (all other types).
     */
    private handleListClick;
    private selectItem;
    private renderLoadingSlot;
    private renderEmptySlot;
    private renderFooterSlot;
    /**
     * Programmatically open the suggestion panel.
     *
     * If `query` is provided, the input value is **not** changed but a fetch is
     * issued for that query. When omitted, the current input value is used.
     * If the value is shorter than `minChars` and there are already cached
     * items, those are shown immediately (useful for `openOnFocus` behaviour).
     *
     * @param query - Optional query to fetch suggestions for.
     */
    open(query?: string): void;
    /** Close the suggestion panel without selecting an item. */
    close(): void;
    /**
     * Programmatically set the input value and optionally trigger a fetch.
     *
     * @param value - The new input value.
     * @param triggerFetch - When `true` (default) a data fetch is issued if
     *   `value.length >= minChars`.
     */
    setQuery(value: string, triggerFetch?: boolean): void;
    /**
     * Re-fetch suggestions for the current query, bypassing the cache.
     * Useful after a mutation that invalidates previously cached results.
     */
    refresh(): void;
    /** Evict all entries from the in-memory query cache. */
    clearCache(): void;
    /**
     * Subscribe to a Praescio event.
     *
     * @param event - The event name (see {@link PraescioEvents} for the full list).
     * @param handler - Callback invoked when the event fires.
     * @returns An unsubscribe function; call it to remove the listener.
     *
     * @example
     * ```ts
     * const off = ac.on('select', (item) => console.log(item.label));
     * // later …
     * off();
     * ```
     */
    on<K extends PraescioEventName>(event: K, handler: PraescioEventHandler<K>): () => void;
    on(event: string, handler: (...args: unknown[]) => void): () => void;
    /** Remove a previously registered event handler. */
    off<K extends PraescioEventName>(event: K, handler: PraescioEventHandler<K>): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
    /**
     * Tear down the instance completely.
     *
     * Removes the suggestion panel from the DOM, cancels all pending fetches,
     * clears the cache, removes all event listeners, and strips the ARIA
     * attributes that were added to the input element.
     *
     * After `destroy()` is called every method becomes a no-op.
     */
    destroy(): void;
}

interface RecentSearchesOptions {
    /** Maximum number of entries to persist. Default: `5`. */
    maxItems?: number;
    /** `localStorage` key used for persistence. Default: `"praescio_recent_searches"`. */
    storageKey?: string;
    /** Custom label for the group header. Default: `"Recent"`. */
    groupLabel?: string;
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
declare function recentSearches(opts?: RecentSearchesOptions): PraescioPlugin;

interface FuzzyMatchOptions {
    /**
     * Maximum Levenshtein edit distance to consider a match.
     * Lower values = stricter matching. Default: `2`.
     */
    threshold?: number;
}
/**
 * A plugin that wraps the existing source with fuzzy matching.
 * Items whose label is within `threshold` edits of the query are included,
 * sorted by ascending distance.
 */
declare function fuzzyMatch(opts?: FuzzyMatchOptions): PraescioPlugin;

interface KeyboardShortcutOptions {
    /**
     * Key to listen for (case-insensitive, e.g. `'k'` for ⌘K / Ctrl+K).
     * Default: `'k'`.
     */
    key?: string;
    /** Require the Meta key (⌘ on Mac). Default: `true`. */
    meta?: boolean;
    /** Require the Ctrl key. Default: `true`. */
    ctrl?: boolean;
    /** Require the Alt/Option key. Default: `false`. */
    alt?: boolean;
    /** Require the Shift key. Default: `false`. */
    shift?: boolean;
}
/**
 * Opens the Praescio panel when a configurable keyboard shortcut is pressed
 * from anywhere on the page (not just when the input is focused).
 */
declare function keyboardShortcut(opts?: KeyboardShortcutOptions): PraescioPlugin;

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
declare function analytics(opts: AnalyticsOptions): PraescioPlugin;

export { Praescio, analytics, Praescio as default, fuzzyMatch, keyboardShortcut, recentSearches };
export type { CacheStrategy, CustomItem, DataSource, DataSourceFn, DescriptionItem, DividerItem, GroupHeader, IconItem, LinkItem, PanelPlacement, PraescioEventHandler, PraescioEventName, PraescioEvents, PraescioOptions, PraescioPlugin, PraescioPublicAPI, PraescioSlots, ResolvedOptions, RichItem, SelectableItem, SuggestionItem, TextItem };
