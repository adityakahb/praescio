import type { SuggestionItem } from './SuggestionItem';

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
export interface PraescioEvents {
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
export type PraescioEventName = keyof PraescioEvents;

/** Infers the correct handler signature for a given event name. */
export type PraescioEventHandler<K extends PraescioEventName> = PraescioEvents[K];
