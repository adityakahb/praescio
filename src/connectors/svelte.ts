/**
 * @module praescio/connectors/svelte
 *
 * Svelte connector for Praescio — a pure Svelte action that requires no
 * imports from the Svelte package. Svelte actions are just functions that
 * return `{ update?, destroy }`, so this module has zero build-time
 * framework dependencies.
 *
 * @peerDependency svelte ≥ 4
 *
 * @example Usage in a Svelte component
 * ```svelte
 * <script lang="ts">
 * import { praescioAction } from 'praescio/connectors';
 * import 'praescio/css';
 *
 * const countries = ['Austria', 'Belgium', 'Croatia', 'Denmark'];
 * let selected = '';
 *
 * $: options = {
 *   source: countries,
 *   onSelect: (item) => { selected = item.label; },
 * };
 * </script>
 *
 * <input use:praescioAction={options} placeholder="Search countries…" />
 * {#if selected}<p>Selected: {selected}</p>{/if}
 * ```
 *
 * @remarks
 * When the `options` binding changes (e.g. the `source` array is updated),
 * Svelte calls the action's `update` method, which destroys the old Praescio
 * instance and creates a fresh one with the new options.
 */

import type { PraescioOptions } from '../types/PraescioOptions';
import type { PraescioPublicAPI } from '../types/Plugin';
import { Praescio } from '../core/Praescio';

/**
 * The return type of a Svelte action.
 *
 * Matches the `ActionReturn<Parameter>` shape from `svelte/action` so the
 * object is assignable when svelte is installed as a peer dependency.
 *
 * @typeParam T - Raw item type passed through to Praescio options.
 */
export interface SvelteActionReturn<T = unknown> {
  /**
   * Called by Svelte whenever the bound parameter object changes.
   * Recreates the Praescio instance with the new options.
   *
   * @param params - Updated Praescio options.
   */
  update(params: PraescioOptions<T>): void;

  /** Called by Svelte when the element is removed from the DOM. */
  destroy(): void;
}

/**
 * Svelte action — mount Praescio on a native `<input>` element.
 *
 * Apply with `use:praescioAction={options}` in the component template.
 *
 * Lifecycle:
 * - **mount** (`use:` directive first applied): creates the Praescio instance.
 * - **update** (binding changes): destroys the old instance, creates a new one.
 * - **destroy** (element removed): destroys the instance and cleans up the DOM.
 *
 * @param node - The `<input>` element Svelte applies the action to.
 * @param params - Praescio configuration options.
 * @returns A Svelte action return object with `update` and `destroy` callbacks.
 *
 * @typeParam T - Raw item type returned by the data source.
 *
 * @example
 * ```svelte
 * <input use:praescioAction={{ source: items, onSelect: handleSelect }} />
 * ```
 */
export function praescioAction<T = unknown>(
  node: HTMLInputElement,
  params: PraescioOptions<T>
): SvelteActionReturn<T> {
  let instance: PraescioPublicAPI = new Praescio<T>(node, params);

  return {
    /**
     * Recreates the instance whenever the bound options object changes.
     * This ensures option changes (e.g. a new async `source`) are honoured
     * without requiring a full component remount.
     */
    update(newParams: PraescioOptions<T>): void {
      instance.destroy();
      instance = new Praescio<T>(node, newParams);
    },

    /** Tears down Praescio and removes all side-effects from the DOM. */
    destroy(): void {
      instance.destroy();
    },
  };
}
