import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keyboardShortcut } from '../../src/plugins/keyboardShortcut';
import type { PraescioPublicAPI } from '../../src/types/Plugin';

type DestroyHandler = () => void;

function makeInstance(): { instance: PraescioPublicAPI; triggerDestroy: () => void } {
  let destroyHandler: DestroyHandler | undefined;
  const instance = {
    open: vi.fn(),
    on: vi.fn((event: string, handler: DestroyHandler) => {
      if (event === 'destroy') destroyHandler = handler;
      return () => undefined;
    }),
  } as unknown as PraescioPublicAPI;
  return {
    instance,
    triggerDestroy: () => destroyHandler?.(),
  };
}

function fireKeydown(
  key: string,
  modifiers: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}
): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      metaKey: modifiers.metaKey ?? false,
      ctrlKey: modifiers.ctrlKey ?? false,
      altKey: modifiers.altKey ?? false,
      shiftKey: modifiers.shiftKey ?? false,
    })
  );
}

// ── keyboardShortcut plugin ───────────────────────────────────────────────────

describe('keyboardShortcut — plugin metadata', () => {
  it('has name "keyboardShortcut"', () => {
    expect(keyboardShortcut().name).toBe('keyboardShortcut');
  });
});

describe('keyboardShortcut — shortcut activation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the instance when ⌘K is pressed', () => {
    const { instance, triggerDestroy } = makeInstance();
    keyboardShortcut({ key: 'k', meta: true, ctrl: false }).install(instance);
    fireKeydown('k', { metaKey: true });
    expect(instance.open).toHaveBeenCalledOnce();
    triggerDestroy();
  });

  it('opens the instance when Ctrl+K is pressed', () => {
    const { instance, triggerDestroy } = makeInstance();
    keyboardShortcut({ key: 'k', meta: false, ctrl: true }).install(instance);
    fireKeydown('k', { ctrlKey: true });
    expect(instance.open).toHaveBeenCalledOnce();
    triggerDestroy();
  });

  it('is case-insensitive for the key', () => {
    const { instance, triggerDestroy } = makeInstance();
    keyboardShortcut({ key: 'K', meta: true, ctrl: false }).install(instance);
    fireKeydown('k', { metaKey: true });
    expect(instance.open).toHaveBeenCalledOnce();
    triggerDestroy();
  });

  it('does not open when no modifier is pressed', () => {
    const { instance, triggerDestroy } = makeInstance();
    keyboardShortcut({ key: 'k' }).install(instance);
    fireKeydown('k');
    expect(instance.open).not.toHaveBeenCalled();
    triggerDestroy();
  });

  it('does not open when a different key is pressed', () => {
    const { instance, triggerDestroy } = makeInstance();
    keyboardShortcut({ key: 'k', meta: true, ctrl: false }).install(instance);
    fireKeydown('j', { metaKey: true });
    expect(instance.open).not.toHaveBeenCalled();
    triggerDestroy();
  });

  it('removes the keydown listener on destroy', () => {
    const { instance, triggerDestroy } = makeInstance();
    keyboardShortcut({ key: 'k', meta: true, ctrl: false }).install(instance);
    triggerDestroy();
    fireKeydown('k', { metaKey: true });
    expect(instance.open).not.toHaveBeenCalled();
  });
});
