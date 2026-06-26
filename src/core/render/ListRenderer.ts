/**
 * @fileoverview List rendering subsystem for Praescio.
 *
 * Renders the `role="listbox"` container and each suggestion item inside it.
 * Supports two rendering modes:
 *
 * - **Full render** (default) — all items are inserted into the DOM at once.
 * - **Virtual scroll** — only the visible viewport slice plus an overscan buffer
 *   are rendered. Activated when `virtualScroll: true` or automatically when
 *   `virtualScroll: 'auto'` and the item count exceeds {@link VIRTUAL_THRESHOLD}.
 *
 * Navigation state (highlighted index, focus) is managed externally by
 * {@link KeyboardHandler} and communicated back through
 * `setHighlighted()` / `focusItem()`.
 */

import type { SuggestionItem } from '../../types/SuggestionItem';
import { isSelectable } from '../../types/SuggestionItem';
import { renderItem, type RenderedItem } from './ItemRenderer';
import { el } from '../../utils/dom';
import type { CommonOptions } from '../../types/PraescioOptions';

/** Item count above which virtual scrolling is enabled in 'auto' mode. */
const VIRTUAL_THRESHOLD = 100;
/** Estimated item height in px — used to size the virtual scroll spacer. */
const ITEM_HEIGHT_ESTIMATE = 44;
/** Number of extra items rendered above and below the visible viewport. */
const OVERSCAN = 5;

/**
 * Manages the `role="listbox"` DOM element and its suggestion item children.
 * One instance per Praescio instance.
 */
export class ListRenderer {
  readonly listEl: HTMLElement;
  private rendered: RenderedItem[] = [];
  private items: SuggestionItem[] = [];
  private query = '';
  private options: CommonOptions;
  private selectableIndices: number[] = [];

  // Virtual scroll state
  private virtual = false;
  private scrollEl: HTMLElement | null = null;
  private containerEl: HTMLElement | null = null;
  private visibleStart = 0;
  private visibleEnd = 0;
  private heights: number[] = [];
  private rafId: number | null = null;

  constructor(listId: string, options: CommonOptions) {
    this.options = options;
    this.listEl = el('div', {
      class: 'praescio__list',
      role: 'listbox',
      id: listId,
      'aria-label': options.ariaLabel,
    });
  }

  render(items: SuggestionItem[], query: string): void {
    this.cleanup();
    this.items = items;
    this.query = query;
    this.rendered = [];

    // Determine selectable item indices (used for keyboard navigation)
    this.selectableIndices = items.reduce<number[]>((acc, item, i) => {
      if (isSelectable(item)) acc.push(i);
      return acc;
    }, []);

    const shouldVirtual =
      this.options.virtualScroll === true ||
      (this.options.virtualScroll === 'auto' && items.length > VIRTUAL_THRESHOLD);

    this.virtual = shouldVirtual;
    this.listEl.innerHTML = '';

    if (shouldVirtual) {
      this.renderVirtual();
    } else {
      this.renderAll();
    }
  }

  private renderAll(): void {
    const { items, query, options } = this;
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const rendered = renderItem(item, query, options.highlight);
      this.rendered.push(rendered);
      fragment.appendChild(rendered.node);
    }
    this.listEl.appendChild(fragment);
  }

  private renderVirtual(): void {
    const { items } = this;
    this.heights = items.map(() => ITEM_HEIGHT_ESTIMATE);
    const totalHeight = this.heights.reduce((a, b) => a + b, 0);

    // Scroll container
    const scrollEl = el('div', { class: 'praescio__list-scroll' });
    scrollEl.style.overflowY = 'auto';
    scrollEl.style.maxHeight = '18rem';
    scrollEl.style.position = 'relative';

    // Spacer for total height
    const spacer = el('div', { class: 'praescio__list-spacer' });
    spacer.style.height = `${totalHeight}px`;
    spacer.style.position = 'relative';

    // Visible container — absolutely positioned inside spacer
    const containerEl = el('div', { class: 'praescio__list-viewport' });
    containerEl.style.position = 'absolute';
    containerEl.style.width = '100%';
    containerEl.style.top = '0';

    spacer.appendChild(containerEl);
    scrollEl.appendChild(spacer);
    this.listEl.appendChild(scrollEl);
    this.scrollEl = scrollEl;
    this.containerEl = containerEl;

    this.updateVisibleWindow(0);

    const onScroll = () => {
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => {
        this.updateVisibleWindow(scrollEl.scrollTop);
        this.rafId = null;
      });
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    this.rendered.push({
      node: scrollEl,
      cleanup: () => {
        scrollEl.removeEventListener('scroll', onScroll);
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      },
    });
  }

  private updateVisibleWindow(scrollTop: number): void {
    const { items, heights, containerEl, options } = this;
    if (!containerEl) return;

    // Compute which items are in view
    let accumulated = 0;
    let start = 0;
    for (let i = 0; i < heights.length; i++) {
      if (accumulated + (heights[i] ?? ITEM_HEIGHT_ESTIMATE) > scrollTop) {
        start = i;
        break;
      }
      accumulated += heights[i] ?? ITEM_HEIGHT_ESTIMATE;
    }

    const panelHeight = parseFloat(getComputedStyle(this.listEl).maxHeight) || 288;
    let end = start;
    let visible = 0;
    while (end < items.length && visible < panelHeight + OVERSCAN * ITEM_HEIGHT_ESTIMATE) {
      visible += heights[end] ?? ITEM_HEIGHT_ESTIMATE;
      end++;
    }

    start = Math.max(0, start - OVERSCAN);
    end = Math.min(items.length, end + OVERSCAN);

    if (start === this.visibleStart && end === this.visibleEnd) return;
    this.visibleStart = start;
    this.visibleEnd = end;

    // Compute offset top for the visible slice
    let offsetTop = 0;
    for (let i = 0; i < start; i++) offsetTop += heights[i] ?? ITEM_HEIGHT_ESTIMATE;

    containerEl.innerHTML = '';
    containerEl.style.top = `${offsetTop}px`;
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const item = items[i];
      if (!item) continue;
      const rendered = renderItem(item, this.query, options.highlight);
      fragment.appendChild(rendered.node);
    }
    containerEl.appendChild(fragment);
  }

  /**
   * Update the visual highlight (aria-selected + CSS class) to the given
   * selectable index. Pass `-1` to clear the highlight entirely.
   */
  setHighlighted(index: number): void {
    // Clear all
    const current = this.listEl.querySelectorAll<HTMLElement>('[aria-selected="true"]');
    for (const node of current) {
      node.setAttribute('aria-selected', 'false');
      node.classList.remove('praescio__item--highlighted');
    }
    if (index < 0) return;

    const item = this.getSelectableNodeAt(index);
    if (item) {
      item.setAttribute('aria-selected', 'true');
      item.classList.add('praescio__item--highlighted');
      // Ensure item is scrolled into view
      item.scrollIntoView({ block: 'nearest' });
    }
  }

  /** Move DOM focus to the item at the given selectable index. */
  focusItem(index: number): void {
    const item = this.getSelectableNodeAt(index);
    item?.focus();
  }

  private getSelectableNodeAt(selectableIndex: number): HTMLElement | null {
    const options = this.listEl.querySelectorAll<HTMLElement>('[role="option"]');
    return options[selectableIndex] ?? null;
  }

  /** Total number of selectable (`role="option"`) items currently in the DOM. */
  getSelectableCount(): number {
    return this.listEl.querySelectorAll('[role="option"]').length;
  }

  /**
   * Return the {@link SuggestionItem} that corresponds to the nth selectable
   * position in the list. Non-selectable items (group headers, dividers) are
   * excluded from the index so keyboard navigation skips them.
   */
  getItemAtSelectableIndex(index: number): SuggestionItem | undefined {
    return this.items[this.selectableIndices[index] ?? -1];
  }

  /**
   * Replace the list contents with a single full-width slot element.
   *
   * @param type - Controls the CSS modifier class and the default text.
   * @param content - Optional custom content. Accepts an `HTMLElement` (appended
   *   as-is) or a string (set as `textContent`). Falls back to the default copy
   *   when omitted.
   */
  showSlot(type: 'loading' | 'empty' | 'error', content?: string | HTMLElement | undefined): void {
    this.listEl.innerHTML = '';
    const slot = el('div', {
      class: `praescio__slot praescio__slot--${type}`,
      'aria-live': 'polite',
    });
    if (content instanceof HTMLElement) {
      slot.append(content);
    } else {
      slot.textContent = content ?? this.defaultSlotText(type);
    }
    this.listEl.append(slot);
  }

  private defaultSlotText(type: string): string {
    if (type === 'loading') return 'Loading…';
    if (type === 'empty') return 'No results found.';
    if (type === 'error') return 'An error occurred. Please try again.';
    return '';
  }

  appendSlotNode(position: 'before' | 'after', node: HTMLElement): void {
    if (position === 'before') {
      this.listEl.insertBefore(node, this.listEl.firstChild);
    } else {
      this.listEl.append(node);
    }
  }

  private cleanup(): void {
    for (const item of this.rendered) {
      item.cleanup?.();
    }
    this.rendered = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.cleanup();
    this.listEl.remove();
  }
}
