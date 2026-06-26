/**
 * @fileoverview Global test setup for Vitest (jsdom environment).
 *
 * Polyfills browser APIs that jsdom does not implement but are needed by
 * Praescio's DOM subsystems. Each stub is installed once here rather than
 * duplicated across individual test files.
 */

// ── ResizeObserver ────────────────────────────────────────────────────────────
// jsdom does not implement ResizeObserver. Provide a no-op stub so that
// PanelManager (and any component that opens the panel) can be exercised
// without unhandled-rejection noise.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
  };
}
