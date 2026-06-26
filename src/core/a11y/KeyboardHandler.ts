/**
 * @fileoverview Keyboard navigation controller for the Praescio suggestion panel.
 *
 * Handles all keyboard interactions required by the WAI-ARIA 1.2 combobox
 * pattern. Two separate `keydown` listeners are registered:
 *
 * 1. **Input listener** (`handleKeydown`) — fires while the text input has
 *    DOM focus. Manages navigation (Arrow*, Home, End, Page*), selection
 *    (Enter, Tab), and dismissal (Escape).
 *
 * 2. **List listener** (`handleListKeydown`) — fires while a list item has
 *    DOM focus. Printable characters redirect focus back to the input so
 *    the user can keep typing; navigation / selection keys are delegated to
 *    `handleKeydown`; unrecognised non-printable keys close the panel.
 */

import type { StateManager } from '../state/StateManager';
import type { ListRenderer } from '../render/ListRenderer';
import type { InputController } from '../input/InputController';
import type { CommonOptions } from '../../types/PraescioOptions';
import type { SuggestionItem } from '../../types/SuggestionItem';

/** Number of items skipped by a single PageDown / PageUp keystroke. */
const PAGE_SIZE = 5;

/**
 * Wires keyboard interactions to the suggestion panel.
 *
 * Instantiated once per Praescio instance. Delegates navigation state changes
 * through {@link StateManager} and focus management through
 * {@link InputController} / {@link ListRenderer}.
 */
export class KeyboardHandler {
  private input: HTMLElement;
  private stateManager: StateManager;
  private listRenderer: ListRenderer;
  private inputController: InputController;
  private options: CommonOptions;
  private onSelectItem: (item: SuggestionItem, event: KeyboardEvent) => void;
  private cleanups: Array<() => void> = [];

  /**
   * @param input - The host input (or contenteditable) element.
   * @param stateManager - Shared state container; keyboard actions dispatch to it.
   * @param listRenderer - Provides item count and focus management.
   * @param inputController - Used to return DOM focus to the input.
   * @param options - Resolved instance options (only `selectOnTab` is read here).
   * @param onSelectItem - Callback invoked when the user confirms a selection
   *   via Enter or Tab.
   */
  constructor(
    input: HTMLElement,
    stateManager: StateManager,
    listRenderer: ListRenderer,
    inputController: InputController,
    options: CommonOptions,
    onSelectItem: (item: SuggestionItem, event: KeyboardEvent) => void
  ) {
    this.input = input;
    this.stateManager = stateManager;
    this.listRenderer = listRenderer;
    this.inputController = inputController;
    this.options = options;
    this.onSelectItem = onSelectItem;
    this.bind();
  }

  private bind(): void {
    const onKeydown = (e: Event) => this.handleKeydown(e as KeyboardEvent);

    this.input.addEventListener('keydown', onKeydown);
    this.cleanups.push(() => this.input.removeEventListener('keydown', onKeydown));

    // Also handle keydown on list items (for when focus has moved into the list)
    const onListKeydown = (e: Event) => this.handleListKeydown(e as KeyboardEvent);
    this.listRenderer.listEl.addEventListener('keydown', onListKeydown);
    this.cleanups.push(() =>
      this.listRenderer.listEl.removeEventListener('keydown', onListKeydown)
    );
  }

  private handleKeydown(e: KeyboardEvent): void {
    const state = this.stateManager.getState();

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (state.status !== 'open') return;
        const total = this.listRenderer.getSelectableCount();
        if (total === 0) return;
        const next = state.highlightedIndex < total - 1 ? state.highlightedIndex + 1 : 0;
        this.highlightAndFocus(next);
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        if (state.status !== 'open') return;
        const total = this.listRenderer.getSelectableCount();
        if (total === 0) return;
        if (state.highlightedIndex <= 0) {
          // Wrap back to input
          this.stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: -1 });
          this.inputController.focus();
        } else {
          this.highlightAndFocus(state.highlightedIndex - 1);
        }
        break;
      }

      case 'Home': {
        if (state.status !== 'open') return;
        e.preventDefault();
        this.highlightAndFocus(0);
        break;
      }

      case 'End': {
        if (state.status !== 'open') return;
        e.preventDefault();
        const total = this.listRenderer.getSelectableCount();
        if (total > 0) this.highlightAndFocus(total - 1);
        break;
      }

      case 'PageDown': {
        if (state.status !== 'open') return;
        e.preventDefault();
        const total = this.listRenderer.getSelectableCount();
        const next = Math.min(state.highlightedIndex + PAGE_SIZE, total - 1);
        this.highlightAndFocus(next);
        break;
      }

      case 'PageUp': {
        if (state.status !== 'open') return;
        e.preventDefault();
        const next = Math.max(state.highlightedIndex - PAGE_SIZE, 0);
        this.highlightAndFocus(next);
        break;
      }

      case 'Enter': {
        if (state.status !== 'open' || state.highlightedIndex < 0) return;
        e.preventDefault();
        const item = this.listRenderer.getItemAtSelectableIndex(state.highlightedIndex);
        if (item) this.onSelectItem(item, e);
        break;
      }

      case 'Tab': {
        if (state.status !== 'open') return;
        if (!this.options.selectOnTab) return;
        if (state.highlightedIndex < 0) return;
        e.preventDefault();
        const item = this.listRenderer.getItemAtSelectableIndex(state.highlightedIndex);
        if (item) this.onSelectItem(item, e);
        break;
      }

      case 'Escape': {
        if (state.status === 'open' || state.status === 'loading' || state.status === 'empty') {
          e.preventDefault();
          e.stopPropagation();
          this.stateManager.dispatch({ type: 'CLOSE' });
          this.inputController.focus();
        }
        break;
      }
    }
  }

  private handleListKeydown(e: KeyboardEvent): void {
    const state = this.stateManager.getState();

    // Printable characters typed while an item is focused → redirect to input
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.inputController.focus();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
      case 'PageDown':
      case 'PageUp':
      case 'Enter':
      case 'Tab':
      case 'Escape':
        this.handleKeydown(e);
        break;

      default:
        if (state.status === 'open') {
          this.stateManager.dispatch({ type: 'CLOSE' });
        }
    }
  }

  private highlightAndFocus(index: number): void {
    this.stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index });
    this.listRenderer.focusItem(index);
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }
}
