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

import type { PraescioOptions } from '../types/PraescioOptions';
import type { PraescioPublicAPI } from '../types/Plugin';
import { Praescio } from '../core/Praescio';

// ---------------------------------------------------------------------------
// Minimal React hook type stubs
// These interfaces describe only the React APIs this connector depends on so
// that the file compiles without installing react as a devDependency. When
// consumers install the react peer dependency they automatically get the real
// typings, which are compatible with these stubs.
// ---------------------------------------------------------------------------

/** A mutable React ref object (created with `useRef(initialValue)`). */
export interface ReactMutableRef<T> {
  current: T;
}

/** A read-only React ref object (created with `useRef<T>(null)`). */
export interface ReactReadonlyRef<T> {
  readonly current: T | null;
}

/**
 * Minimal shape of the React hooks this connector requires.
 *
 * Pass the real `React` namespace object or a plain object with these two
 * functions extracted from it (e.g. `{ useEffect, useRef }`).
 */
export interface ReactHooksLike {
  /**
   * Schedules an effect after render.
   * @param effect - Callback that may return a cleanup function.
   * @param deps - Dependency array; pass `[]` for a mount-only effect.
   */
  useEffect(effect: () => void | (() => void), deps: unknown[]): void;

  /** Overload for mutable refs initialised with a non-null value. */
  useRef<T>(initialValue: T): ReactMutableRef<T>;
  /** Overload for refs initialised as null (the common DOM-ref pattern). */
  useRef<T>(initialValue: null): ReactReadonlyRef<T>;
}

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
export function createReactPraescio(hooks: ReactHooksLike) {
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
  return function usePraescio<T = unknown>(
    inputRef: ReactReadonlyRef<HTMLInputElement>,
    options: PraescioOptions<T>
  ): ReactMutableRef<PraescioPublicAPI | null> {
    const instanceRef = hooks.useRef<PraescioPublicAPI | null>(null);

    hooks.useEffect(() => {
      const el = inputRef.current;
      if (!el) return;

      const ac = new Praescio<T>(el, options);
      (instanceRef as ReactMutableRef<PraescioPublicAPI | null>).current = ac;

      return () => {
        ac.destroy();
        (instanceRef as ReactMutableRef<PraescioPublicAPI | null>).current = null;
      };
      // Options object excluded from deps — pass a stable reference or reset
      // the component key to reinitialise with new options.
    }, []);

    return instanceRef as ReactMutableRef<PraescioPublicAPI | null>;
  };
}
