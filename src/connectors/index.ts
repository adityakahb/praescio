/**
 * @module praescio/connectors
 *
 * Framework adapters for React, Vue 3, Angular, and Svelte.
 *
 * Each connector is a thin wrapper around the Praescio core that integrates
 * with its framework's component lifecycle. No framework packages are needed
 * as devDependencies — the connectors use a factory / base-class pattern so
 * they compile without the peer packages installed.
 *
 * ---
 *
 * ### React (≥ 17)
 * ```ts
 * import { createReactPraescio } from 'praescio/connectors';
 * import React, { useRef } from 'react';
 *
 * const usePraescio = createReactPraescio(React);
 *
 * function SearchInput() {
 *   const ref = useRef(null);
 *   usePraescio(ref, { source: items });
 *   return <input ref={ref} />;
 * }
 * ```
 *
 * ### Vue 3
 * ```ts
 * import { createVuePraescio } from 'praescio/connectors';
 * import { ref, onMounted, onBeforeUnmount } from 'vue';
 *
 * const usePraescio = createVuePraescio({ ref, onMounted, onBeforeUnmount });
 * ```
 *
 * ### Angular (≥ 15)
 * ```ts
 * import { PraescioDirectiveBase } from 'praescio/connectors';
 * // Extend PraescioDirectiveBase and add @Directive / @Input decorators.
 * ```
 *
 * ### Svelte (≥ 4)
 * ```svelte
 * <script>
 *   import { praescioAction } from 'praescio/connectors';
 * </script>
 * <input use:praescioAction={options} />
 * ```
 */

// React
export { createReactPraescio } from './react';
export type { ReactHooksLike, ReactMutableRef, ReactReadonlyRef } from './react';

// Vue 3
export { createVuePraescio } from './vue';
export type { VueLike, VueRef } from './vue';

// Angular
export { PraescioDirectiveBase } from './angular';

// Svelte
export { praescioAction } from './svelte';
export type { SvelteActionReturn } from './svelte';
