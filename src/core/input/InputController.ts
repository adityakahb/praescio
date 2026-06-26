import { debounce } from '../../utils/debounce';
import type { StateManager } from '../state/StateManager';
import type { CommonOptions } from '../../types/PraescioOptions';

/**
 * Manages the host input element: binds DOM events, debounces queries, and
 * handles IME composition so CJK typing does not fire mid-composition fetches.
 *
 * **Query trimming:** `input` events trim leading/trailing whitespace before
 * the `minChars` check and before the debounced fetch. This prevents blank or
 * whitespace-only values from opening the suggestion panel. `getValue()` always
 * returns the raw (untrimmed) DOM value — trimming is applied only when the
 * value is used as a search query.
 */
export class InputController {
  private input: HTMLElement;
  private stateManager: StateManager;
  private options: CommonOptions;
  private isComposing = false;
  private debouncedQuery: ReturnType<typeof debounce<[string]>>;
  private cleanups: Array<() => void> = [];

  constructor(
    input: HTMLElement,
    stateManager: StateManager,
    options: CommonOptions,
    onQuery: (query: string) => void
  ) {
    this.input = input;
    this.stateManager = stateManager;
    this.options = options;
    this.debouncedQuery = debounce((query: string) => {
      onQuery(query);
    }, options.debounce);

    this.bind();
  }

  private bind(): void {
    const { input } = this;

    const onInput = () => {
      if (this.isComposing) return;
      // Trim so that whitespace-only input never opens the panel.
      const query = this.getValue().trim();
      this.stateManager.dispatch({ type: 'QUERY_CHANGED', query });
      if (query.length >= this.options.minChars) {
        this.debouncedQuery(query);
      } else if (query.length === 0) {
        this.debouncedQuery.cancel();
        this.stateManager.dispatch({ type: 'CLOSE' });
      }
    };

    const onCompositionStart = () => {
      this.isComposing = true;
    };

    const onCompositionEnd = () => {
      this.isComposing = false;
      onInput();
    };

    const onFocus = () => {
      if (!this.options.openOnFocus) return;
      // Trim for comparison consistency — state.query is always a trimmed string.
      const query = this.getValue().trim();
      const state = this.stateManager.getState();
      if (state.items.length > 0 && query === state.query) {
        this.stateManager.dispatch({ type: 'OPEN_CACHED', items: state.items });
      }
    };

    input.addEventListener('input', onInput);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('focus', onFocus);

    this.cleanups.push(
      () => input.removeEventListener('input', onInput),
      () => input.removeEventListener('compositionstart', onCompositionStart),
      () => input.removeEventListener('compositionend', onCompositionEnd),
      () => input.removeEventListener('focus', onFocus)
    );
  }

  /**
   * Returns the raw (untrimmed) current value of the host element.
   * For `<input>` and `<textarea>` this is `.value`; for `contenteditable`
   * it is `.textContent`.
   */
  getValue(): string {
    const { input } = this;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      return input.value;
    }
    return input.textContent ?? '';
  }

  /** Set the host element's value without triggering an `input` event. */
  setValue(value: string): void {
    const { input } = this;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.value = value;
    } else {
      input.textContent = value;
    }
  }

  /** Move DOM focus to the host input element. */
  focus(): void {
    this.input.focus();
  }

  destroy(): void {
    this.debouncedQuery.cancel();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }
}
