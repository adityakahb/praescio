import {
  resolveOptions,
  type PraescioOptions,
  type ResolvedOptions,
} from '../types/PraescioOptions';
import type { SuggestionItem } from '../types/SuggestionItem';
import type { PraescioPublicAPI } from '../types/Plugin';
import type { PraescioEventName, PraescioEventHandler } from '../types/Events';

import { StateManager } from './state/StateManager';
import { DataController } from './data/DataController';
import { InputController } from './input/InputController';
import { ContentEditableCtrl } from './input/ContentEditableCtrl';
import { ListRenderer } from './render/ListRenderer';
import { PanelManager, buildPanelShell } from './render/PanelManager';
import { A11yController } from './a11y/A11yController';
import { KeyboardHandler } from './a11y/KeyboardHandler';
import { LiveRegion } from './a11y/LiveRegion';
import { PluginRegistry } from './plugins/PluginRegistry';
import { EventEmitter } from './EventEmitter';

import { resolveElement, contains, sanitizeHref } from '../utils/dom';
import { uid } from '../utils/uid';

/**
 * The main Praescio autocomplete/typeahead controller.
 *
 * Attach it to any `<input>` or `contenteditable` element and supply a data
 * source; Praescio handles debouncing, caching, keyboard navigation,
 * accessibility (ARIA combobox pattern), and rendering.
 *
 * @typeParam T - Type of the raw items returned by the data source, before
 *   any `transform` is applied.
 *
 * @example Static array source
 * ```ts
 * import Praescio from 'praescio';
 * import 'praescio/css';
 *
 * const ac = new Praescio('#city-input', {
 *   source: ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin'],
 *   onSelect: (item) => console.log('chosen:', item.label),
 * });
 * ```
 *
 * @example Async REST source with custom transform
 * ```ts
 * interface User { id: number; login: string; avatar_url: string }
 *
 * const ac = new Praescio<User>('#user-search', {
 *   source: async (query, signal) => {
 *     const res = await fetch(`/api/users?q=${query}`, { signal });
 *     return res.json();
 *   },
 *   transform: (u) => ({
 *     type: 'rich',
 *     label: u.login,
 *     icon: u.avatar_url,
 *     value: String(u.id),
 *   }),
 *   debounce: 200,
 *   minChars: 2,
 *   plugins: [keyboardShortcut({ key: 'k' })],
 * });
 * ```
 */
export class Praescio<T = unknown> implements PraescioPublicAPI {
  /** Library version string. Consumers can read this without instantiating. */
  static readonly currentVersion = '1.0.0';

  private inputEl: HTMLElement;
  private options: ResolvedOptions<T>;
  private instanceId: string;

  private stateManager: StateManager;
  private dataController: DataController<T>;
  private inputController: InputController;
  private contentEditableCtrl: ContentEditableCtrl | null = null;
  private listRenderer: ListRenderer;
  private panelManager: PanelManager;
  private a11yController: A11yController;
  private keyboardHandler: KeyboardHandler;
  private liveRegion: LiveRegion;
  private pluginRegistry: PluginRegistry;
  private emitter: EventEmitter;

  private unsubscribeState: () => void;
  private outsideClickCleanup: () => void;
  private listClickCleanup: () => void;
  private panelPointerdownCleanup: () => void;
  private destroyed = false;

  /**
   * Create a new Praescio autocomplete instance.
   *
   * @param target - A CSS selector string or a direct `HTMLElement` reference
   *   for the input that will be enhanced.
   * @param options - Configuration; see {@link PraescioOptions} for the full
   *   reference. The only required field is `source`.
   * @throws {Error} If `target` is a string that matches no element in the DOM.
   */
  constructor(target: string | HTMLElement, options: PraescioOptions<T>) {
    this.inputEl = resolveElement(target);
    this.options = resolveOptions(options);
    this.instanceId = uid('praescio');

    const listId = `${this.instanceId}-list`;
    const panelId = `${this.instanceId}-panel`;

    // ── State ──────────────────────────────────────────────────────────────
    this.stateManager = new StateManager();

    // ── Data ───────────────────────────────────────────────────────────────
    this.dataController = new DataController(this.stateManager, this.options);

    // ── Live region (SR announcements) ─────────────────────────────────────
    this.liveRegion = new LiveRegion();

    // ── Rendering ──────────────────────────────────────────────────────────
    this.listRenderer = new ListRenderer(listId, this.options);
    const container = this.resolveContainer();
    const panel = buildPanelShell(panelId, this.listRenderer.listEl, this.options.slots);
    container.appendChild(panel);
    this.panelManager = new PanelManager(panel, this.inputEl, this.options);

    // ── A11y ───────────────────────────────────────────────────────────────
    this.a11yController = new A11yController(
      this.inputEl,
      this.listRenderer,
      this.liveRegion,
      listId,
      this.options
    );

    // ── Input ──────────────────────────────────────────────────────────────
    this.inputController = new InputController(
      this.inputEl,
      this.stateManager,
      this.options,
      (query) => this.onQueryReady(query)
    );

    if (this.options.trigger && this.inputEl.isContentEditable) {
      this.contentEditableCtrl = new ContentEditableCtrl(this.inputEl, this.options.trigger);
    }

    // ── Keyboard ───────────────────────────────────────────────────────────
    this.keyboardHandler = new KeyboardHandler(
      this.inputEl,
      this.stateManager,
      this.listRenderer,
      this.inputController,
      this.options,
      (item, event) => this.selectItem(item, event)
    );

    // ── Events ─────────────────────────────────────────────────────────────
    this.emitter = new EventEmitter();

    // ── State subscription ─────────────────────────────────────────────────
    this.unsubscribeState = this.stateManager.subscribe((next, prev) => {
      // Panel open/close
      if (next.status !== prev.status) {
        if (next.status === 'open' || next.status === 'empty' || next.status === 'loading') {
          this.panelManager.open();
        } else if (next.status === 'idle' || next.status === 'error') {
          this.panelManager.close();
        }

        this.a11yController.handleStatusChange(next.status, next.query, next.items);

        if (next.status === 'open') {
          this.options.onOpen?.();
          this.emitter.emit('open');
        } else if (prev.status === 'open' && (next.status === 'idle' || next.status === 'error')) {
          this.options.onClose?.();
          this.emitter.emit('close');
        } else if (next.status === 'empty' && prev.status !== 'empty') {
          // Emit 'empty' on the first transition into empty state for this query
          this.options.onEmpty?.(next.query);
          this.emitter.emit('empty', next.query);
        }
      }

      // Results
      if (next.items !== prev.items) {
        if (next.status === 'open') {
          this.listRenderer.render(next.items, next.query);
          this.renderFooterSlot(next.query);
        } else if (next.status === 'empty') {
          this.renderEmptySlot(next.query);
        } else if (next.status === 'loading') {
          this.renderLoadingSlot();
        } else if (next.status === 'error') {
          this.listRenderer.showSlot('error');
        }
      } else if (next.status === 'loading' && prev.status !== 'loading') {
        this.renderLoadingSlot();
      } else if (next.status === 'empty' && prev.status !== 'empty') {
        this.renderEmptySlot(next.query);
      }

      // Highlight
      if (next.highlightedIndex !== prev.highlightedIndex) {
        this.listRenderer.setHighlighted(next.highlightedIndex);
        if (next.highlightedIndex >= 0) {
          const total = this.listRenderer.getSelectableCount();
          this.a11yController.handleHighlightChange(next.highlightedIndex, next.items, total);
          const highlightedItem = next.items[next.highlightedIndex] ?? null;
          this.options.onHighlight?.(highlightedItem, next.highlightedIndex);
          this.emitter.emit('highlight', highlightedItem, next.highlightedIndex);
        } else {
          // Highlight cleared
          this.options.onHighlight?.(null, -1);
          this.emitter.emit('highlight', null, -1);
        }
      }
    });

    // ── Outside-click to close ─────────────────────────────────────────────
    const onOutsideClick = (e: Event) => {
      const target = e.target as Node;
      if (!contains(this.inputEl, target) && !contains(panel, target)) {
        const state = this.stateManager.getState();
        if (state.status === 'open' || state.status === 'loading' || state.status === 'empty') {
          this.stateManager.dispatch({ type: 'CLOSE' });
        }
      }
    };
    document.addEventListener('pointerdown', onOutsideClick);
    this.outsideClickCleanup = () => document.removeEventListener('pointerdown', onOutsideClick);

    // ── Panel pointerdown: prevent focus loss for non-link items ───────────
    // For <div> items we cancel the default so the input stays focused.
    // For <a> link items we leave the default intact so the browser follows href.
    const onPanelPointerdown = (e: PointerEvent) => {
      const option = (e.target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
      if (option && option.tagName !== 'A') {
        e.preventDefault();
      }
    };
    panel.addEventListener('pointerdown', onPanelPointerdown as EventListener);
    this.panelPointerdownCleanup = () =>
      panel.removeEventListener('pointerdown', onPanelPointerdown as EventListener);

    // ── List click: handle item selection ──────────────────────────────────
    const onListClick = (e: Event) => this.handleListClick(e as MouseEvent);
    this.listRenderer.listEl.addEventListener('click', onListClick);
    this.listClickCleanup = () =>
      this.listRenderer.listEl.removeEventListener('click', onListClick);

    // ── Plugins ────────────────────────────────────────────────────────────
    this.pluginRegistry = new PluginRegistry();
    this.pluginRegistry.installAll(this.options.plugins, this, this.options);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private resolveContainer(): HTMLElement {
    if (!this.options.container) return document.body;
    if (typeof this.options.container === 'string') {
      return resolveElement(this.options.container);
    }
    return this.options.container;
  }

  /**
   * Called by `InputController` after debounce with the already-trimmed query.
   * Fires the `query` event and delegates to `DataController` when the query
   * meets the `minChars` threshold.
   */
  private onQueryReady(query: string): void {
    this.options.onQuery?.(query);
    this.emitter.emit('query', query);
    if (query.length >= this.options.minChars) {
      void this.dataController.fetch(query);
    }
  }

  /**
   * Handle a click on a list item.
   *
   * Uses event delegation: finds the closest `[role="option"]` ancestor of the
   * clicked target, maps it to a `SuggestionItem`, then either navigates (link
   * items) or calls `selectItem` (all other types).
   */
  private handleListClick(e: MouseEvent): void {
    const option = (e.target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
    if (!option) return;

    const options = this.listRenderer.listEl.querySelectorAll<HTMLElement>('[role="option"]');
    const index = Array.from(options).indexOf(option);
    if (index < 0) return;

    const item = this.listRenderer.getItemAtSelectableIndex(index);
    if (!item) return;

    if (item.type === 'link') {
      // The <a> element handles navigation naturally via its href.
      // We only need to close the panel and emit the select event.
      this.stateManager.dispatch({ type: 'ITEM_SELECTED', item, originalEvent: e });
      if (this.options.closeOnSelect) this.panelManager.close();
      this.options.onSelect?.(item, e);
      this.emitter.emit('select', item, e);
      return;
    }

    this.selectItem(item, e);
  }

  private selectItem(item: SuggestionItem, event: Event): void {
    if (item.type === 'link') {
      // Keyboard-triggered selection: navigate programmatically.
      // Click-triggered selection is handled by handleListClick instead.
      const safe = sanitizeHref(item.href);
      if (safe !== '#') {
        if (item.target === '_blank') {
          window.open(safe, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = safe;
        }
      }
    } else if (this.contentEditableCtrl && this.options.insertTemplate) {
      // In @mention mode, insert the text at cursor
      this.contentEditableCtrl.insertMention(this.options.insertTemplate(item));
    } else if ('value' in item || 'label' in item) {
      const val = (item as { value?: string }).value ?? (item as { label: string }).label;
      this.inputController.setValue(val);
    }

    this.stateManager.dispatch({ type: 'ITEM_SELECTED', item, originalEvent: event });

    if (this.options.closeOnSelect) {
      this.panelManager.close();
    }

    this.options.onSelect?.(item, event);
    this.emitter.emit('select', item, event);

    this.inputController.focus();
  }

  private renderLoadingSlot(): void {
    const slot = this.options.slots?.loading;
    if (slot instanceof HTMLElement) {
      this.listRenderer.showSlot('loading', slot.cloneNode(true) as HTMLElement);
    } else if (typeof slot === 'string') {
      this.listRenderer.showSlot('loading', slot);
    } else {
      this.listRenderer.showSlot('loading');
    }
  }

  private renderEmptySlot(query: string): void {
    if (!this.options.showEmpty) {
      this.panelManager.close();
      return;
    }
    const slot = this.options.slots?.empty;
    if (typeof slot === 'function') {
      this.listRenderer.showSlot('empty', slot(query));
    } else if (typeof slot === 'string') {
      this.listRenderer.showSlot('empty', slot);
    } else {
      this.listRenderer.showSlot('empty');
    }
  }

  private renderFooterSlot(query: string): void {
    const slot = this.options.slots?.footer;
    if (!slot) return;
    const footerEl = this.panelManager.panel.querySelector('.praescio__panel__footer');
    if (!footerEl) return;
    footerEl.innerHTML = '';
    if (typeof slot === 'function') {
      footerEl.appendChild(slot(query));
    } else if (typeof slot === 'string') {
      const text = document.createElement('span');
      text.textContent = slot;
      footerEl.appendChild(text);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Programmatically open the suggestion panel.
   *
   * If `query` is provided, the input value is **not** changed but a fetch is
   * issued for that query. When omitted, the current input value is used.
   * If the value is shorter than `minChars` and there are already cached
   * items, those are shown immediately (useful for `openOnFocus` behaviour).
   *
   * @param query - Optional query to fetch suggestions for.
   */
  open(query?: string): void {
    if (this.destroyed) return;
    const q = query ?? this.inputController.getValue();
    if (q.length >= this.options.minChars) {
      void this.dataController.fetch(q);
    } else {
      const state = this.stateManager.getState();
      if (state.items.length > 0) {
        this.stateManager.dispatch({ type: 'OPEN_CACHED', items: state.items });
      }
    }
  }

  /** Close the suggestion panel without selecting an item. */
  close(): void {
    if (this.destroyed) return;
    this.stateManager.dispatch({ type: 'CLOSE' });
    this.panelManager.close();
  }

  /**
   * Programmatically set the input value and optionally trigger a fetch.
   *
   * @param value - The new input value.
   * @param triggerFetch - When `true` (default) a data fetch is issued if
   *   `value.length >= minChars`.
   */
  setQuery(value: string, triggerFetch = true): void {
    if (this.destroyed) return;
    this.inputController.setValue(value);
    this.stateManager.dispatch({ type: 'QUERY_CHANGED', query: value });
    if (triggerFetch && value.length >= this.options.minChars) {
      void this.dataController.fetch(value);
    }
  }

  /**
   * Re-fetch suggestions for the current query, bypassing the cache.
   * Useful after a mutation that invalidates previously cached results.
   */
  refresh(): void {
    if (this.destroyed) return;
    const query = this.stateManager.getState().query;
    if (query.length >= this.options.minChars) {
      void this.dataController.fetch(query);
    }
  }

  /** Evict all entries from the in-memory query cache. */
  clearCache(): void {
    this.dataController.clearCache();
  }

  /**
   * Subscribe to a Praescio event.
   *
   * @param event - The event name (see {@link PraescioEvents} for the full list).
   * @param handler - Callback invoked when the event fires.
   * @returns An unsubscribe function; call it to remove the listener.
   *
   * @example
   * ```ts
   * const off = ac.on('select', (item) => console.log(item.label));
   * // later …
   * off();
   * ```
   */
  on<K extends PraescioEventName>(event: K, handler: PraescioEventHandler<K>): () => void;
  on(event: string, handler: (...args: unknown[]) => void): () => void;
  on(event: string, handler: (...args: unknown[]) => void): () => void {
    return this.emitter.on(event, handler);
  }

  /** Remove a previously registered event handler. */
  off<K extends PraescioEventName>(event: K, handler: PraescioEventHandler<K>): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.off(event, handler);
  }

  /**
   * Tear down the instance completely.
   *
   * Removes the suggestion panel from the DOM, cancels all pending fetches,
   * clears the cache, removes all event listeners, and strips the ARIA
   * attributes that were added to the input element.
   *
   * After `destroy()` is called every method becomes a no-op.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.options.onDestroy?.();
    this.emitter.emit('destroy');
    this.stateManager.dispatch({ type: 'DESTROY' });
    this.unsubscribeState();
    this.outsideClickCleanup();
    this.panelPointerdownCleanup();
    this.listClickCleanup();
    this.inputController.destroy();
    this.keyboardHandler.destroy();
    this.dataController.destroy();
    this.listRenderer.destroy();
    this.panelManager.destroy();
    this.liveRegion.destroy();
    this.stateManager.destroy();
    this.emitter.destroy();

    // Remove ARIA attrs from input
    this.inputEl.removeAttribute('role');
    this.inputEl.removeAttribute('aria-autocomplete');
    this.inputEl.removeAttribute('aria-haspopup');
    this.inputEl.removeAttribute('aria-expanded');
    this.inputEl.removeAttribute('aria-controls');
  }
}
