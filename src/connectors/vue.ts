/**
 * @module praescio/connectors/vue
 *
 * Vue 3 connector for Praescio — zero-dependency adapter using a factory
 * pattern so no Vue import is needed at build time. Pass the Composition API
 * helpers at call-site.
 *
 * @peerDependency vue ≥ 3
 *
 * @example Basic usage (Options API / script setup)
 * ```vue
 * <script setup lang="ts">
 * import { ref, onMounted, onBeforeUnmount } from 'vue';
 * import { createVuePraescio } from 'praescio/connectors';
 * import 'praescio/css';
 *
 * const usePraescio = createVuePraescio({ ref, onMounted, onBeforeUnmount });
 *
 * const inputRef = ref<HTMLInputElement | null>(null);
 * usePraescio(inputRef, {
 *   source: ['Amsterdam', 'Berlin', 'Copenhagen'],
 *   onSelect: (item) => console.log('chosen:', item.label),
 * });
 * </script>
 *
 * <template>
 *   <input ref="inputRef" placeholder="Search cities…" />
 * </template>
 * ```
 *
 * @remarks
 * Options are read once on mount. For reactive option changes, call
 * `instance.value?.clearCache()` and `instance.value?.refresh()` inside a
 * Vue `watch`.
 */

import type { PraescioOptions } from '../types/PraescioOptions';
import type { PraescioPublicAPI } from '../types/Plugin';
import { Praescio } from '../core/Praescio';

// ---------------------------------------------------------------------------
// Minimal Vue 3 Composition API type stubs
// Only the three lifecycle helpers this connector depends on are described
// here so the file compiles without vue as a devDependency.
// ---------------------------------------------------------------------------

/** A Vue 3 reactive ref object (created with `ref(value)`). */
export interface VueRef<T> {
  value: T;
}

/**
 * Minimal shape of the Vue 3 Composition API this connector requires.
 *
 * Pass `{ ref, onMounted, onBeforeUnmount }` imported directly from `vue`.
 */
export interface VueLike {
  /** Creates a reactive reference. */
  ref<T>(value: T): VueRef<T>;
  /** Registers a callback to run after the component is mounted. */
  onMounted(fn: () => void): void;
  /** Registers a callback to run just before the component is unmounted. */
  onBeforeUnmount(fn: () => void): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a `usePraescio` Vue 3 composable bound to the supplied Vue APIs.
 *
 * @param vue - Object with `{ ref, onMounted, onBeforeUnmount }` from `vue`.
 * @returns A `usePraescio(inputRef, options)` composable function.
 *
 * @example
 * ```ts
 * import { ref, onMounted, onBeforeUnmount } from 'vue';
 * import { createVuePraescio } from 'praescio/connectors';
 *
 * export const usePraescio = createVuePraescio({ ref, onMounted, onBeforeUnmount });
 * ```
 */
export function createVuePraescio(vue: VueLike) {
  /**
   * Vue 3 composable — mounts Praescio on the referenced `<input>` element.
   *
   * Registers `onMounted` (creates the instance) and `onBeforeUnmount`
   * (destroys it) lifecycle hooks automatically. Returns a reactive ref so
   * you can call instance methods from the template or other composables.
   *
   * @param inputRef - A Vue `ref` pointing to the target `<input>` element.
   * @param options - Praescio options (read once on mount).
   * @returns A reactive `VueRef` whose `.value` is the live
   *   {@link PraescioPublicAPI} instance, or `null` before mount / after unmount.
   */
  return function usePraescio<T = unknown>(
    inputRef: VueRef<HTMLInputElement | null>,
    options: PraescioOptions<T>
  ): VueRef<PraescioPublicAPI | null> {
    const instance = vue.ref<PraescioPublicAPI | null>(null);

    vue.onMounted(() => {
      const el = inputRef.value;
      if (!el) return;
      const ac = new Praescio<T>(el, options);
      instance.value = ac;
    });

    vue.onBeforeUnmount(() => {
      instance.value?.destroy();
      instance.value = null;
    });

    return instance;
  };
}
