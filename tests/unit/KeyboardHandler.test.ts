/**
 * @fileoverview Unit tests for {@link KeyboardHandler}.
 *
 * Verifies every keyboard case handled by the input-level and list-level
 * keydown listeners: navigation keys (Arrow*, Home, End, PageUp/Down),
 * selection (Enter, Tab), dismissal (Escape), and the "printable character
 * while list item is focused" redirect behaviour.
 */

import { describe, it, expect, vi } from 'vitest';
import { KeyboardHandler } from '../../src/core/a11y/KeyboardHandler';
import { StateManager } from '../../src/core/state/StateManager';
import { ListRenderer } from '../../src/core/render/ListRenderer';
import { InputController } from '../../src/core/input/InputController';
import type { SuggestionItem } from '../../src/types/SuggestionItem';
import type { CommonOptions } from '../../src/types/PraescioOptions';

// ── Helpers ────────────────────────────────────────────────────────────────────

const BASE_OPTIONS: CommonOptions = {
  highlight: true,
  minChars: 1,
  maxItems: 10,
  cache: 'none',
  cacheTTL: 0,
  selectOnTab: true,
  closeOnSelect: true,
  openOnFocus: false,
  showEmpty: true,
  virtualScroll: false,
  placement: 'auto',
  offset: 4,
  debounce: 0,
  ariaLabel: 'Suggestions',
  plugins: [],
} as unknown as CommonOptions;

const ITEMS: SuggestionItem[] = [
  { type: 'text', label: 'Alpha' },
  { type: 'text', label: 'Beta' },
  { type: 'text', label: 'Gamma' },
  { type: 'text', label: 'Delta' },
  { type: 'text', label: 'Epsilon' },
  { type: 'text', label: 'Zeta' },
];

/** Fire a synthetic KeyboardEvent on an element. */
function fire(el: HTMLElement, key: string, extra: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...extra,
  });
  el.dispatchEvent(event);
  return event;
}

function makeSetup(
  opts: Partial<CommonOptions> = {},
  items: SuggestionItem[] = ITEMS
): {
  input: HTMLInputElement;
  stateManager: StateManager;
  listRenderer: ListRenderer;
  inputController: InputController;
  onSelect: ReturnType<typeof vi.fn>;
  handler: KeyboardHandler;
} {
  const input = document.createElement('input');
  document.body.appendChild(input);

  const stateManager = new StateManager();
  const mergedOptions = { ...BASE_OPTIONS, ...opts } as unknown as CommonOptions;

  const listRenderer = new ListRenderer('list-kh', mergedOptions);
  document.body.appendChild(listRenderer.listEl);

  const inputController = new InputController(input, stateManager, mergedOptions, vi.fn());

  const onSelect = vi.fn();

  const handler = new KeyboardHandler(
    input,
    stateManager,
    listRenderer,
    inputController,
    mergedOptions,
    onSelect
  );

  // Render items and open the panel. RESULTS_READY only applies when query matches,
  // so dispatch FETCH_START first to set the current query, then RESULTS_READY.
  stateManager.dispatch({ type: 'FETCH_START', query: 'a' });
  stateManager.dispatch({ type: 'RESULTS_READY', items, query: 'a' });
  listRenderer.render(items, 'a');

  return { input, stateManager, listRenderer, inputController, onSelect, handler };
}

// ── ArrowDown ──────────────────────────────────────────────────────────────────

describe('KeyboardHandler — ArrowDown', () => {
  it('does nothing when panel is closed', () => {
    const { input, stateManager } = makeSetup();
    // status is open after RESULTS_READY; close it first
    stateManager.dispatch({ type: 'CLOSE' });
    const before = stateManager.getState().highlightedIndex;
    fire(input, 'ArrowDown');
    expect(stateManager.getState().highlightedIndex).toBe(before);
  });

  it('moves highlight to first item from -1', () => {
    const { input, stateManager } = makeSetup();
    // highlight starts at -1
    fire(input, 'ArrowDown');
    expect(stateManager.getState().highlightedIndex).toBe(0);
  });

  it('advances to the next item', () => {
    const { input, stateManager } = makeSetup();
    fire(input, 'ArrowDown');
    fire(input, 'ArrowDown');
    expect(stateManager.getState().highlightedIndex).toBe(1);
  });

  it('wraps around to 0 when at the last item', () => {
    const { input, stateManager } = makeSetup();
    const total = ITEMS.length;
    // advance to last item
    for (let i = 0; i < total; i++) fire(input, 'ArrowDown');
    // one more → wraps to 0
    fire(input, 'ArrowDown');
    expect(stateManager.getState().highlightedIndex).toBe(0);
  });

  it('prevents default', () => {
    const { input } = makeSetup();
    const e = fire(input, 'ArrowDown');
    expect(e.defaultPrevented).toBe(true);
  });
});

// ── ArrowUp ────────────────────────────────────────────────────────────────────

describe('KeyboardHandler — ArrowUp', () => {
  it('does nothing when panel is closed', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'CLOSE' });
    const before = stateManager.getState().highlightedIndex;
    fire(input, 'ArrowUp');
    expect(stateManager.getState().highlightedIndex).toBe(before);
  });

  it('returns focus to input when highlight is at 0', () => {
    const { input, stateManager, inputController } = makeSetup();
    const focusSpy = vi.spyOn(inputController, 'focus');
    // Move to index 0 first
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 0 });
    fire(input, 'ArrowUp');
    expect(focusSpy).toHaveBeenCalled();
    expect(stateManager.getState().highlightedIndex).toBe(-1);
  });

  it('moves highlight to the previous item', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 3 });
    fire(input, 'ArrowUp');
    expect(stateManager.getState().highlightedIndex).toBe(2);
  });

  it('prevents default', () => {
    const { input } = makeSetup();
    const e = fire(input, 'ArrowUp');
    expect(e.defaultPrevented).toBe(true);
  });
});

// ── Home / End ─────────────────────────────────────────────────────────────────

describe('KeyboardHandler — Home', () => {
  it('does nothing when panel is closed', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'CLOSE' });
    fire(input, 'Home');
    expect(stateManager.getState().highlightedIndex).toBe(-1);
  });

  it('moves highlight to index 0', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 4 });
    fire(input, 'Home');
    expect(stateManager.getState().highlightedIndex).toBe(0);
  });

  it('prevents default', () => {
    const { input } = makeSetup();
    const e = fire(input, 'Home');
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('KeyboardHandler — End', () => {
  it('does nothing when panel is closed', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'CLOSE' });
    fire(input, 'End');
    expect(stateManager.getState().highlightedIndex).toBe(-1);
  });

  it('moves highlight to the last selectable item', () => {
    const { input, stateManager } = makeSetup();
    fire(input, 'End');
    expect(stateManager.getState().highlightedIndex).toBe(ITEMS.length - 1);
  });

  it('prevents default', () => {
    const { input } = makeSetup();
    const e = fire(input, 'End');
    expect(e.defaultPrevented).toBe(true);
  });
});

// ── PageDown / PageUp ─────────────────────────────────────────────────────────

describe('KeyboardHandler — PageDown', () => {
  it('does nothing when panel is closed', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'CLOSE' });
    fire(input, 'PageDown');
    expect(stateManager.getState().highlightedIndex).toBe(-1);
  });

  it('advances by PAGE_SIZE (5)', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 0 });
    fire(input, 'PageDown');
    // min(0+5, total-1) = 5
    expect(stateManager.getState().highlightedIndex).toBe(5);
  });

  it('clamps at the last item', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 4 });
    fire(input, 'PageDown');
    expect(stateManager.getState().highlightedIndex).toBe(5);
  });

  it('prevents default', () => {
    const { input } = makeSetup();
    const e = fire(input, 'PageDown');
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('KeyboardHandler — PageUp', () => {
  it('does nothing when panel is closed', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'CLOSE' });
    fire(input, 'PageUp');
    expect(stateManager.getState().highlightedIndex).toBe(-1);
  });

  it('goes back by PAGE_SIZE (5)', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 5 });
    fire(input, 'PageUp');
    expect(stateManager.getState().highlightedIndex).toBe(0);
  });

  it('clamps at 0', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 2 });
    fire(input, 'PageUp');
    expect(stateManager.getState().highlightedIndex).toBe(0);
  });

  it('prevents default', () => {
    const { input } = makeSetup();
    const e = fire(input, 'PageUp');
    expect(e.defaultPrevented).toBe(true);
  });
});

// ── Enter ──────────────────────────────────────────────────────────────────────

describe('KeyboardHandler — Enter', () => {
  it('does nothing when panel is closed', () => {
    const { input, stateManager, onSelect } = makeSetup();
    stateManager.dispatch({ type: 'CLOSE' });
    fire(input, 'Enter');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing when no item is highlighted', () => {
    const { input, onSelect } = makeSetup();
    // highlightedIndex defaults to -1
    fire(input, 'Enter');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect with the highlighted item', () => {
    const { input, stateManager, onSelect } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 0 });
    fire(input, 'Enter');
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0], expect.any(KeyboardEvent));
  });

  it('prevents default when an item is selected', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 1 });
    const e = fire(input, 'Enter');
    expect(e.defaultPrevented).toBe(true);
  });
});

// ── Tab ────────────────────────────────────────────────────────────────────────

describe('KeyboardHandler — Tab (selectOnTab=true)', () => {
  it('selects the highlighted item', () => {
    const { input, stateManager, onSelect } = makeSetup({ selectOnTab: true });
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 2 });
    fire(input, 'Tab');
    expect(onSelect).toHaveBeenCalledWith(ITEMS[2], expect.any(KeyboardEvent));
  });

  it('does nothing when no item is highlighted', () => {
    const { input, onSelect } = makeSetup({ selectOnTab: true });
    fire(input, 'Tab');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('KeyboardHandler — Tab (selectOnTab=false)', () => {
  it('does not select when selectOnTab is false', () => {
    const { input, stateManager, onSelect } = makeSetup({ selectOnTab: false });
    stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 0 });
    fire(input, 'Tab');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ── Escape ────────────────────────────────────────────────────────────────────

describe('KeyboardHandler — Escape', () => {
  it('closes the panel when it is open', () => {
    const { input, stateManager } = makeSetup();
    // panel is open after RESULTS_READY
    fire(input, 'Escape');
    expect(stateManager.getState().status).toBe('idle');
  });

  it('stops propagation when panel is open', () => {
    const { input } = makeSetup();
    const e = fire(input, 'Escape');
    expect(e.defaultPrevented).toBe(true);
  });

  it('does nothing when panel is already closed', () => {
    const { input, stateManager } = makeSetup();
    stateManager.dispatch({ type: 'CLOSE' });
    const before = stateManager.getState().status;
    fire(input, 'Escape');
    expect(stateManager.getState().status).toBe(before);
  });
});

// ── List-level keydown (handleListKeydown) ────────────────────────────────────

describe('KeyboardHandler — handleListKeydown', () => {
  it('redirects printable characters to the input (focus)', () => {
    const { inputController, listRenderer } = makeSetup();
    const focusSpy = vi.spyOn(inputController, 'focus');
    const e = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    listRenderer.listEl.dispatchEvent(e);
    expect(focusSpy).toHaveBeenCalled();
  });

  it('does NOT redirect ctrl+key combinations to the input', () => {
    const { inputController, listRenderer } = makeSetup();
    const focusSpy = vi.spyOn(inputController, 'focus');
    const e = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    listRenderer.listEl.dispatchEvent(e);
    // focus() should NOT be called as a printable-character redirect
    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('delegates ArrowDown from list element to the same handler', () => {
    const { stateManager, listRenderer } = makeSetup();
    const e = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    listRenderer.listEl.dispatchEvent(e);
    // Should have moved highlight
    expect(stateManager.getState().highlightedIndex).toBe(0);
  });

  it('delegates Escape from list element to close the panel', () => {
    const { stateManager, listRenderer } = makeSetup();
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    listRenderer.listEl.dispatchEvent(e);
    expect(stateManager.getState().status).toBe('idle');
  });

  it('closes panel on unrecognised non-printable key while open', () => {
    const { stateManager, listRenderer } = makeSetup();
    // e.g. F5 — key.length > 1, not a recognised navigation key
    const e = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
    listRenderer.listEl.dispatchEvent(e);
    expect(stateManager.getState().status).toBe('idle');
  });
});

// ── destroy ────────────────────────────────────────────────────────────────────

describe('KeyboardHandler — destroy', () => {
  it('removes the keydown listener so keys no longer navigate', () => {
    const { input, stateManager, handler } = makeSetup();
    handler.destroy();
    fire(input, 'ArrowDown');
    // After destroy, nothing should have moved
    expect(stateManager.getState().highlightedIndex).toBe(-1);
  });

  it('calling destroy twice does not throw', () => {
    const { handler } = makeSetup();
    handler.destroy();
    expect(() => handler.destroy()).not.toThrow();
  });
});
