import type { PanelStatus } from '../state/StateMachine';
import type { SuggestionItem } from '../../types/SuggestionItem';
import type { ListRenderer } from '../render/ListRenderer';
import type { LiveRegion } from './LiveRegion';
import type { CommonOptions } from '../../types/PraescioOptions';

/**
 * Manages ARIA state for the autocomplete widget.
 *
 * Responsibilities:
 * - Stamps the input element with the required combobox ARIA attributes on construction.
 * - Keeps `aria-expanded` in sync with the panel open/close state.
 * - Delegates result-count and item announcements to {@link LiveRegion}.
 */
export class A11yController {
  private input: HTMLElement;
  private listRenderer: ListRenderer;
  private liveRegion: LiveRegion;
  private options: CommonOptions;

  constructor(
    input: HTMLElement,
    listRenderer: ListRenderer,
    liveRegion: LiveRegion,
    listId: string,
    options: CommonOptions
  ) {
    this.input = input;
    this.listRenderer = listRenderer;
    this.liveRegion = liveRegion;
    this.options = options;
    this.initInputARIA(listId);
  }

  /** Stamp the input with static combobox ARIA attributes. Called once at construction. */
  private initInputARIA(listId: string): void {
    const { input } = this;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
  }

  /**
   * Called whenever the panel status changes. Updates `aria-expanded` and
   * triggers a live-region announcement for screen-reader users.
   *
   * @param status - New panel status from the state machine.
   * @param query - The active query string at the time of the change.
   * @param items - The current item list (used to count selectable entries).
   */
  handleStatusChange(status: PanelStatus, query: string, items: SuggestionItem[]): void {
    const isOpen = status === 'open';
    this.input.setAttribute('aria-expanded', String(isOpen));

    if (status === 'open') {
      const selectableCount = items.filter(
        (i) => i.type !== 'group' && i.type !== 'divider'
      ).length;
      this.liveRegion.announceResults(selectableCount, query, this.options);
    } else if (status === 'empty') {
      this.liveRegion.announceResults(0, query, this.options);
    }
  }

  /**
   * Called when the keyboard highlight index changes. Announces the newly
   * highlighted item via the live region so screen readers read it aloud.
   *
   * @param index - Zero-based selectable index of the highlighted item.
   * @param items - Full item list (used to look up the item by selectable index).
   * @param total - Total number of selectable items (for positional announcements).
   */
  handleHighlightChange(index: number, items: SuggestionItem[], total: number): void {
    if (index < 0) return;
    const item = this.listRenderer.getItemAtSelectableIndex(index);
    if (!item) return;
    this.liveRegion.announceItem(item, index, total, this.options);
  }
}
