import { Praescio } from 'praescio';

/**
 * @module praescio/connectors/react
 *
 * React connector for Praescio — zero-dependency adapter using a factory pattern
 * so no React import is needed at build time. Pass your React hooks at call-site.
 *
 * @peerDependency react ≥ 17
 *
 * @example Basic usage
 * ```tsx
 * import React, { useRef } from 'react';
 * import { createUsePraescio } from 'praescio/connectors';
 * import 'praescio/css';
 *
 * const usePraescio = createReactPraescio(React);
 *
 * export function CitySearch() {
 *   const inputRef = useRef<HTMLInputElement>(null);
 *   usePraescio(inputRef, {
 *     source: ['Amsterdam', 'Berlin', 'Copenhagen'],
 *     onSelect: (item) => console.log('chosen:', item.label),
 *   });
 *   return <input ref={inputRef} placeholder="Search cities…" />;
 * }
 * ```
 *
 * @remarks
 * Options are consumed once on mount. Wrap dynamic values in a stable React ref
 * or reset the component `key` prop to reinitialise the Praescio instance.
 */
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/**
 * Creates a `usePraescio` React hook bound to the supplied React hooks.
 *
 * @param hooks - The React namespace or `{ useEffect, useRef }` extracted from it.
 * @returns A `usePraescio(inputRef, options)` hook function.
 *
 * @example
 * ```ts
 * import React from 'react';
 * import { createReactPraescio } from 'praescio/connectors';
 *
 * export const usePraescio = createReactPraescio(React);
 * ```
 */
function createReactPraescio(hooks) {
    /**
     * React hook — mounts Praescio on the referenced `<input>` element.
     *
     * Mount happens in a `useEffect` with an empty dependency array; the
     * instance is destroyed in the effect cleanup. The hook returns a mutable
     * ref so callers can imperatively call methods like `instance.current?.open()`.
     *
     * @param inputRef - Ref pointing to the target `<input>` element.
     * @param options - Praescio options (read once on mount).
     * @returns A mutable ref whose `.current` is the live {@link PraescioPublicAPI}
     *   instance, or `null` before mount / after unmount.
     */
    return function usePraescio(inputRef, options) {
        const instanceRef = hooks.useRef(null);
        hooks.useEffect(() => {
            const el = inputRef.current;
            if (!el)
                return;
            const ac = new Praescio(el, options);
            instanceRef.current = ac;
            return () => {
                ac.destroy();
                instanceRef.current = null;
            };
            // Options object excluded from deps — pass a stable reference or reset
            // the component key to reinitialise with new options.
        }, []);
        return instanceRef;
    };
}

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
function createVuePraescio(vue) {
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
    return function usePraescio(inputRef, options) {
        const instance = vue.ref(null);
        vue.onMounted(() => {
            const el = inputRef.value;
            if (!el)
                return;
            const ac = new Praescio(el, options);
            instance.value = ac;
        });
        vue.onBeforeUnmount(() => {
            var _a;
            (_a = instance.value) === null || _a === void 0 ? void 0 : _a.destroy();
            instance.value = null;
        });
        return instance;
    };
}

/**
 * @module praescio/connectors/angular
 *
 * Angular connector for Praescio — a framework-agnostic base class that
 * encapsulates the create/update/destroy lifecycle. In an Angular project,
 * extend this class and apply the standard Angular decorators from
 * `@angular/core`.
 *
 * @peerDependency @angular/core ≥ 15
 *
 * @example Complete Angular standalone directive
 * ```ts
 * // praescio.directive.ts
 * import {
 *   Directive,
 *   Input,
 *   ElementRef,
 *   OnInit,
 *   OnChanges,
 *   OnDestroy,
 * } from '@angular/core';
 * import { PraescioDirectiveBase } from 'praescio/connectors';
 * import type { PraescioOptions } from 'praescio';
 *
 * @Directive({ selector: '[praescio]', standalone: true })
 * export class PraescioDirective<T = unknown>
 *   extends PraescioDirectiveBase<T>
 *   implements OnInit, OnChanges, OnDestroy
 * {
 *   // Bind options via attribute: <input [praescio]="opts" />
 *   @Input('praescio') override options!: PraescioOptions<T>;
 *
 *   constructor(private host: ElementRef<HTMLInputElement>) {
 *     super();
 *   }
 *
 *   ngOnInit(): void {
 *     this.init(this.host.nativeElement);
 *   }
 *
 *   ngOnChanges(): void {
 *     this.reinit(this.host.nativeElement);
 *   }
 *
 *   ngOnDestroy(): void {
 *     this.teardown();
 *   }
 * }
 * ```
 *
 * @example Template
 * ```html
 * <input [praescio]="{ source: countries, onSelect: onCountrySelect }"
 *        placeholder="Search countries…" />
 * ```
 *
 * @example Register in an NgModule (non-standalone)
 * ```ts
 * import { NgModule } from '@angular/core';
 * import { PraescioDirective } from './praescio.directive';
 *
 * @NgModule({ declarations: [PraescioDirective], exports: [PraescioDirective] })
 * export class PraescioModule {}
 * ```
 */
/**
 * Framework-agnostic base class that manages the Praescio lifecycle.
 *
 * Subclass this in your Angular project and delegate the Angular lifecycle
 * hooks (`ngOnInit`, `ngOnChanges`, `ngOnDestroy`) to the corresponding
 * protected methods ({@link init}, {@link reinit}, {@link teardown}).
 *
 * @typeParam T - Raw item type returned by the data source.
 */
class PraescioDirectiveBase {
    constructor() {
        this._instance = null;
    }
    /**
     * The current Praescio instance, or `null` if the directive has not been
     * initialised yet (or has been destroyed).
     */
    get instance() {
        return this._instance;
    }
    /**
     * Create and mount the Praescio instance on `element`.
     *
     * If an instance already exists it is destroyed first, making successive
     * calls safe (e.g. when `ngOnInit` races with `ngOnChanges`).
     *
     * Call from `ngOnInit`.
     *
     * @param element - The host `<input>` element obtained from `ElementRef`.
     */
    init(element) {
        if (this._instance) {
            this._instance.destroy();
        }
        this._instance = new Praescio(element, this.options);
    }
    /**
     * Destroy the current instance and create a fresh one with the latest
     * options. This is the correct response to Angular `@Input` changes.
     *
     * Call from `ngOnChanges`.
     *
     * @param element - The host `<input>` element obtained from `ElementRef`.
     */
    reinit(element) {
        this.teardown();
        this.init(element);
    }
    /**
     * Destroy the Praescio instance and clean up all DOM and event-listener
     * side-effects.
     *
     * Call from `ngOnDestroy`. Safe to call even if `init` was never called.
     */
    teardown() {
        var _a;
        (_a = this._instance) === null || _a === void 0 ? void 0 : _a.destroy();
        this._instance = null;
    }
}

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
function praescioAction(node, params) {
    let instance = new Praescio(node, params);
    return {
        /**
         * Recreates the instance whenever the bound options object changes.
         * This ensures option changes (e.g. a new async `source`) are honoured
         * without requiring a full component remount.
         */
        update(newParams) {
            instance.destroy();
            instance = new Praescio(node, newParams);
        },
        /** Tears down Praescio and removes all side-effects from the DOM. */
        destroy() {
            instance.destroy();
        },
    };
}

export { PraescioDirectiveBase, createReactPraescio, createVuePraescio, praescioAction };
//# sourceMappingURL=praescio-connectors.esm.js.map
