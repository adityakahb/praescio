import { el } from '../../utils/dom';
import type { SuggestionItem } from '../../types/SuggestionItem';
import type { CommonOptions } from '../../types/PraescioOptions';

/**
 * Manages a visually-hidden ARIA live region for screen reader announcements.
 *
 * The node is appended to `document.body` and uses `aria-live="polite"` so
 * announcements do not interrupt ongoing speech. Content is cleared after 3 s
 * to avoid stale text being re-announced after DOM serialisation.
 */
export class LiveRegion {
  private node: HTMLElement;
  private clearTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.node = el('div', {
      class: 'praescio__live',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    document.body.appendChild(this.node);
  }

  announce(text: string): void {
    clearTimeout(this.clearTimer);
    // Reset then set forces re-announcement in screen readers
    this.node.textContent = '';
    // Defer to ensure the DOM mutation is detected as a change
    setTimeout(() => {
      this.node.textContent = text;
      this.clearTimer = setTimeout(() => {
        this.node.textContent = '';
      }, 3000);
    }, 50);
  }

  /**
   * Announce the number of results for the current query.
   * Uses the custom `announceResults` formatter if provided.
   */
  announceResults(count: number, query: string, options: CommonOptions): void {
    if (options.announceResults) {
      this.announce(options.announceResults(count, query));
      return;
    }
    if (count === 0) {
      this.announce(`No results for "${query}".`);
    } else {
      this.announce(`${count} result${count === 1 ? '' : 's'} available.`);
    }
  }

  /**
   * Announce the item currently under keyboard focus.
   * Uses the custom `announceItem` formatter if provided.
   */
  announceItem(item: SuggestionItem, index: number, total: number, options: CommonOptions): void {
    if (options.announceItem) {
      this.announce(options.announceItem(item, index, total));
      return;
    }
    const label = 'label' in item ? (item as { label: string }).label : '';
    const description =
      'description' in item ? ` — ${(item as { description?: string }).description ?? ''}` : '';
    this.announce(`${index + 1} of ${total}: ${label}${description}`);
  }

  destroy(): void {
    clearTimeout(this.clearTimer);
    this.node.remove();
  }
}
