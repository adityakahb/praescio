import type { PraescioOptions } from './PraescioOptions';

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
export interface PraescioPlugin {
  /** Unique identifier; used for deduplication and debugging. */
  name: string;
  /**
   * Called once when the plugin is registered.
   * @param instance - The public API of the Praescio instance.
   * @param options - The resolved (merged-with-defaults) options object.
   *   Plugins may mutate `options` to wrap the data source or override
   *   callbacks (see {@link fuzzyMatch} for an example).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  install(instance: PraescioPublicAPI, options: Readonly<PraescioOptions<any>>): void;
}

/**
 * Subset of the Praescio instance surface exposed to plugins and external consumers.
 *
 * Using this narrower interface (instead of the full `Praescio` class) keeps
 * plugins decoupled from internal implementation details.
 */
export interface PraescioPublicAPI {
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
