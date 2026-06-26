/**
 * Handles @mention mode for contenteditable elements.
 * Detects the trigger character and computes the cursor position
 * for panel placement using Range.getBoundingClientRect().
 */
export class ContentEditableCtrl {
  private el: HTMLElement;
  private trigger: string;

  constructor(el: HTMLElement, trigger: string) {
    this.el = el;
    this.trigger = trigger;
  }

  /** Returns the current query text after the trigger character, or null if not in a mention */
  getActiveMention(): { query: string; triggerStart: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return null;
    if (!this.el.contains(range.startContainer)) return null;

    const text = range.startContainer.textContent ?? '';
    const offset = range.startOffset;
    const before = text.slice(0, offset);
    const lastTrigger = before.lastIndexOf(this.trigger);
    if (lastTrigger === -1) return null;

    // Check there's no whitespace between trigger and cursor
    const betweenTriggerAndCursor = before.slice(lastTrigger + 1);
    if (/\s/.test(betweenTriggerAndCursor)) return null;

    return { query: betweenTriggerAndCursor, triggerStart: lastTrigger };
  }

  /**
   * Returns the pixel position of the cursor for panel placement.
   * Accounts for window scroll.
   */
  getCursorRect(): DOMRect | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return new DOMRect(
      rect.left + window.scrollX,
      rect.top + window.scrollY,
      rect.width,
      rect.height
    );
  }

  /**
   * Insert the replacement text at the current mention position,
   * replacing from the trigger character to the cursor.
   */
  insertMention(text: string): void {
    const mention = this.getActiveMention();
    if (!mention) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const container = range.startContainer;
    const offset = range.startOffset;

    // Select from trigger start to cursor
    const newRange = document.createRange();
    newRange.setStart(container, mention.triggerStart);
    newRange.setEnd(container, offset);
    newRange.deleteContents();

    const textNode = document.createTextNode(text);
    newRange.insertNode(textNode);

    // Move cursor after inserted text
    const after = document.createRange();
    after.setStartAfter(textNode);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  }
}
