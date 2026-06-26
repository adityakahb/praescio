import type { PraescioPlugin, PraescioPublicAPI } from '../types/Plugin';

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
export function keyboardShortcut(opts: KeyboardShortcutOptions = {}): PraescioPlugin {
  const { key = 'k', meta = true, ctrl = true, alt = false, shift = false } = opts;

  return {
    name: 'keyboardShortcut',
    install(instance: PraescioPublicAPI): void {
      const handler = (e: KeyboardEvent) => {
        const metaMatch = !meta || e.metaKey;
        const ctrlMatch = !ctrl || e.ctrlKey;
        const altMatch = !alt || e.altKey;
        const shiftMatch = !shift || e.shiftKey;
        // On Mac, ⌘K; on Windows/Linux, Ctrl+K
        const modifierMatch = (e.metaKey || e.ctrlKey) && (metaMatch || ctrlMatch);
        if (modifierMatch && altMatch && shiftMatch && e.key.toLowerCase() === key.toLowerCase()) {
          e.preventDefault();
          instance.open();
        }
      };

      document.addEventListener('keydown', handler);

      instance.on('destroy' as never, () => {
        document.removeEventListener('keydown', handler);
      });
    },
  };
}
