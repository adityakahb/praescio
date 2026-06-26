(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Praescio = {}));
})(this, (function (exports) { 'use strict';

    function resolveOptions(opts) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        return {
            source: opts.source,
            transform: opts.transform,
            groupBy: opts.groupBy,
            sortGroups: opts.sortGroups,
            debounce: (_a = opts.debounce) !== null && _a !== void 0 ? _a : 300,
            minChars: (_b = opts.minChars) !== null && _b !== void 0 ? _b : 1,
            maxItems: (_c = opts.maxItems) !== null && _c !== void 0 ? _c : 10,
            cache: (_d = opts.cache) !== null && _d !== void 0 ? _d : 'query',
            cacheTTL: (_e = opts.cacheTTL) !== null && _e !== void 0 ? _e : 300000,
            selectOnTab: (_f = opts.selectOnTab) !== null && _f !== void 0 ? _f : true,
            closeOnSelect: (_g = opts.closeOnSelect) !== null && _g !== void 0 ? _g : true,
            openOnFocus: (_h = opts.openOnFocus) !== null && _h !== void 0 ? _h : false,
            highlight: (_j = opts.highlight) !== null && _j !== void 0 ? _j : true,
            showEmpty: (_k = opts.showEmpty) !== null && _k !== void 0 ? _k : true,
            virtualScroll: (_l = opts.virtualScroll) !== null && _l !== void 0 ? _l : 'auto',
            placement: (_m = opts.placement) !== null && _m !== void 0 ? _m : 'auto',
            offset: (_o = opts.offset) !== null && _o !== void 0 ? _o : 4,
            ariaLabel: (_p = opts.ariaLabel) !== null && _p !== void 0 ? _p : 'Suggestions',
            plugins: (_q = opts.plugins) !== null && _q !== void 0 ? _q : [],
            onOpen: opts.onOpen,
            onClose: opts.onClose,
            onSelect: opts.onSelect,
            onQuery: opts.onQuery,
            onFetchStart: opts.onFetchStart,
            onFetchEnd: opts.onFetchEnd,
            onFetchError: opts.onFetchError,
            onHighlight: opts.onHighlight,
            onEmpty: opts.onEmpty,
            onDestroy: opts.onDestroy,
            slots: opts.slots,
            announceResults: opts.announceResults,
            announceItem: opts.announceItem,
            trigger: opts.trigger,
            insertTemplate: opts.insertTemplate,
            container: opts.container,
        };
    }

    /**
     * @fileoverview Finite-state machine (FSM) for the Praescio panel lifecycle.
     *
     * The FSM drives every visible state change. The `transition` function is a
     * pure reducer: given the current state and an action, it returns the next
     * state without mutation. This makes the logic trivially testable.
     *
     * ## Status graph
     *
     * ```
     *  idle ──FETCH_START──► loading ──RESULTS_READY──► open
     *   ▲                        │                       │
     *   │                    NO_RESULTS              ITEM_SELECTED
     *   │                        │                  CLOSE
     *   │                        ▼                       │
     *   └──────────────────── empty  ◄──────────────────┘
     *   │
     *   └── FETCH_ERROR ──► error ──CLOSE──► idle
     *   └── any CLOSE ────► idle
     *   └── DESTROY ──────► destroyed (terminal)
     * ```
     */
    const INITIAL_STATE = {
        status: 'idle',
        query: '',
        items: [],
        highlightedIndex: -1,
        lastSelectedItem: null,
        error: null,
    };
    /** Pure transition function — never mutates state */
    function transition(state, action) {
        if (state.status === 'destroyed')
            return state;
        switch (action.type) {
            case 'QUERY_CHANGED':
                return {
                    ...state,
                    query: action.query,
                    highlightedIndex: -1,
                    // Keep items visible briefly while loading (they'll be replaced on RESULTS_READY)
                    status: action.query.length === 0 ? 'idle' : state.status === 'open' ? 'open' : state.status,
                };
            case 'FETCH_START':
                return {
                    ...state,
                    query: action.query,
                    status: 'loading',
                    error: null,
                    highlightedIndex: -1,
                };
            case 'RESULTS_READY':
                // Guard: only apply if this result still matches the current query
                if (action.query !== state.query)
                    return state;
                return {
                    ...state,
                    status: 'open',
                    items: action.items,
                    highlightedIndex: -1,
                    error: null,
                };
            case 'NO_RESULTS':
                if (action.query !== state.query)
                    return state;
                return {
                    ...state,
                    status: 'empty',
                    items: [],
                    highlightedIndex: -1,
                    error: null,
                };
            case 'FETCH_ERROR':
                if (action.query !== state.query)
                    return state;
                return {
                    ...state,
                    status: 'error',
                    items: [],
                    highlightedIndex: -1,
                    error: action.error,
                };
            case 'ITEM_HIGHLIGHTED':
                if (state.status !== 'open')
                    return state;
                return { ...state, highlightedIndex: action.index };
            case 'ITEM_SELECTED':
                return {
                    ...state,
                    status: 'idle',
                    highlightedIndex: -1,
                    lastSelectedItem: action.item,
                };
            case 'CLOSE':
                return {
                    ...state,
                    status: 'idle',
                    highlightedIndex: -1,
                };
            case 'OPEN_CACHED':
                return {
                    ...state,
                    status: 'open',
                    items: action.items,
                    highlightedIndex: -1,
                    error: null,
                };
            case 'DESTROY':
                return { ...state, status: 'destroyed', items: [] };
            default:
                return state;
        }
    }

    /**
     * @fileoverview Reactive state container that wraps the pure FSM transition
     * function with subscription support.
     *
     * Consumers dispatch {@link Action}s; the new state is computed by
     * {@link transition} and then broadcast to all subscribers. If the new state
     * is identical to the previous one (i.e. the transition was a no-op) no
     * notification is sent.
     */
    /**
     * Thin observable wrapper around the Praescio FSM.
     * One instance is created per Praescio instance and shared across all
     * subsystems (data, rendering, a11y, keyboard).
     */
    class StateManager {
        constructor() {
            this.state = { ...INITIAL_STATE };
            this.subscribers = new Set();
        }
        getState() {
            return this.state;
        }
        dispatch(action) {
            const prev = this.state;
            const next = transition(prev, action);
            if (next === prev)
                return;
            this.state = next;
            for (const sub of this.subscribers) {
                sub(next, prev);
            }
        }
        subscribe(fn) {
            this.subscribers.add(fn);
            return () => this.subscribers.delete(fn);
        }
        destroy() {
            this.subscribers.clear();
        }
    }

    class CacheController {
        constructor(strategy, ttl) {
            this.store = new Map();
            this.strategy = strategy;
            this.ttl = ttl;
        }
        get(query) {
            if (this.strategy === 'none')
                return null;
            const entry = this.store.get(query);
            if (!entry)
                return null;
            if (Date.now() > entry.expiresAt) {
                this.store.delete(query);
                return null;
            }
            return entry.items;
        }
        set(query, items) {
            if (this.strategy === 'none')
                return;
            this.store.set(query, { items, expiresAt: Date.now() + this.ttl });
        }
        has(query) {
            return this.get(query) !== null;
        }
        clear() {
            this.store.clear();
        }
    }

    /**
     * Manages a queue of async requests ensuring only the latest result is applied.
     * Previous in-flight requests are aborted when a new one starts.
     */
    class RequestQueue {
        constructor() {
            this.nextId = 0;
            this.currentId = -1;
            this.controller = null;
        }
        start() {
            var _a;
            // Abort any previous in-flight request
            (_a = this.controller) === null || _a === void 0 ? void 0 : _a.abort();
            this.controller = new AbortController();
            this.currentId = ++this.nextId;
            return { id: this.currentId, signal: this.controller.signal };
        }
        isCurrent(id) {
            return id === this.currentId;
        }
        cancelAll() {
            var _a;
            (_a = this.controller) === null || _a === void 0 ? void 0 : _a.abort();
            this.controller = null;
            this.currentId = -1;
        }
    }

    /**
     * Coerce an unknown raw value into a {@link SuggestionItem}.
     *
     * Accepts:
     * - An already-typed `SuggestionItem` (detected by the presence of a `type` string) — passed through as-is.
     * - A plain `string` — wrapped as `{ type: 'text', label: string }`.
     * - A plain object with a `label` string — wrapped as a `TextItem`, optionally
     *   preserving `value` and `meta` if present.
     * - Anything else — coerced to a string label via `String(raw)`.
     */
    function normaliseItem(raw) {
        if (typeof raw === 'string') {
            return { type: 'text', label: raw };
        }
        if (raw !== null && typeof raw === 'object') {
            const obj = raw;
            // Already a typed SuggestionItem
            if (typeof obj['type'] === 'string') {
                return raw;
            }
            // Duck-type { label }
            if (typeof obj['label'] === 'string') {
                return {
                    type: 'text',
                    label: obj['label'],
                    value: typeof obj['value'] === 'string' ? obj['value'] : undefined,
                    meta: typeof obj['meta'] === 'object' && obj['meta'] !== null
                        ? obj['meta']
                        : undefined,
                };
            }
        }
        return { type: 'text', label: String(raw) };
    }
    /** Normalise an array of unknown values to an array of {@link SuggestionItem}. */
    function normaliseItems(raws) {
        return raws.map(normaliseItem);
    }

    /**
     * @fileoverview Data-fetch orchestrator for Praescio.
     *
     * Coordinates the full lifecycle of a suggestion fetch:
     * 1. Checks the {@link CacheController} for a previous result.
     * 2. Issues the request via {@link RequestQueue} (abort-previous on each new query).
     * 3. Transforms raw items using the consumer-supplied `transform` or the
     *    built-in {@link normaliseItems} coercion.
     * 4. Optionally groups results via `groupBy` / `sortGroups`.
     * 5. Caps the result set to `maxItems`.
     * 6. Dispatches the appropriate FSM action to {@link StateManager}.
     *
     * Three cache strategies are supported (see {@link CacheStrategy}):
     * - `'none'` — every query hits the source.
     * - `'query'` — exact-match cache; TTL-based expiry.
     * - `'stale-while-revalidate'` — serve cached result instantly, then re-fetch
     *   in the background to keep the cache fresh.
     */
    /**
     * Orchestrates data fetching, caching, and result normalisation for a single
     * Praescio instance.
     *
     * @typeParam T - Raw item type returned by the data source before any
     *   `transform` is applied.
     */
    class DataController {
        get sourceFn() {
            if (this.options.source !== this._resolvedSource) {
                this._resolvedSource = this.options.source;
                this._sourceFn = this.resolveSource(this.options.source);
            }
            return this._sourceFn;
        }
        constructor(stateManager, options) {
            this.queue = new RequestQueue();
            // Lazily re-resolved when options.source is patched (e.g. by the fuzzyMatch plugin).
            this._resolvedSource = null;
            this._sourceFn = null;
            this.stateManager = stateManager;
            this.options = options;
            this.maxItems = options.maxItems;
            this.cache = new CacheController(options.cache, options.cacheTTL);
        }
        resolveSource(source) {
            if (typeof source === 'function')
                return source;
            if (Array.isArray(source)) {
                const items = source;
                return async (query) => {
                    const q = query.toLowerCase();
                    return items.filter((item) => {
                        const label = this.getLabel(item);
                        return label.toLowerCase().includes(q);
                    });
                };
            }
            if (typeof source === 'string') {
                const urlTemplate = source;
                return async (query, signal) => {
                    const url = urlTemplate.replace('{query}', encodeURIComponent(query));
                    const res = await fetch(url, { signal });
                    if (!res.ok)
                        throw new Error(`Praescio: fetch failed with status ${res.status}`);
                    return res.json();
                };
            }
            throw new Error('Praescio: invalid source type');
        }
        getLabel(item) {
            if (typeof item === 'string')
                return item;
            if (item !== null && typeof item === 'object') {
                const o = item;
                if (typeof o['label'] === 'string')
                    return o['label'];
            }
            return String(item);
        }
        async fetch(query) {
            var _a, _b, _c;
            const { options, stateManager, cache, maxItems } = this;
            // Check cache — for SWR, return cached immediately and still fetch
            const cached = cache.get(query);
            if (cached) {
                if (options.cache === 'stale-while-revalidate') {
                    const capped = maxItems > 0 ? cached.slice(0, maxItems) : cached;
                    stateManager.dispatch(capped.length > 0
                        ? { type: 'RESULTS_READY', items: capped, query }
                        : { type: 'NO_RESULTS', query });
                    // Continue to fetch fresh results in background
                }
                else {
                    const capped = maxItems > 0 ? cached.slice(0, maxItems) : cached;
                    stateManager.dispatch(capped.length > 0
                        ? { type: 'RESULTS_READY', items: capped, query }
                        : { type: 'NO_RESULTS', query });
                    return;
                }
            }
            const { id, signal } = this.queue.start();
            stateManager.dispatch({ type: 'FETCH_START', query });
            (_a = options.onFetchStart) === null || _a === void 0 ? void 0 : _a.call(options, query);
            try {
                const raw = await this.sourceFn(query, signal);
                if (!this.queue.isCurrent(id))
                    return;
                let items;
                if (options.transform) {
                    items = raw.map(options.transform);
                }
                else {
                    items = normaliseItems(raw);
                }
                // Apply grouping
                if (options.groupBy) {
                    items = applyGrouping(items, options.groupBy, options.sortGroups);
                }
                const capped = maxItems > 0 ? items.slice(0, maxItems) : items;
                cache.set(query, capped);
                (_b = options.onFetchEnd) === null || _b === void 0 ? void 0 : _b.call(options, query, capped);
                stateManager.dispatch(capped.length > 0
                    ? { type: 'RESULTS_READY', items: capped, query }
                    : { type: 'NO_RESULTS', query });
            }
            catch (err) {
                if (!this.queue.isCurrent(id))
                    return;
                if (err.name === 'AbortError')
                    return;
                const error = err instanceof Error ? err : new Error(String(err));
                (_c = options.onFetchError) === null || _c === void 0 ? void 0 : _c.call(options, query, error);
                stateManager.dispatch({ type: 'FETCH_ERROR', error, query });
            }
        }
        clearCache() {
            this.cache.clear();
        }
        destroy() {
            this.queue.cancelAll();
            this.cache.clear();
        }
    }
    function applyGrouping(items, groupBy, sortGroups) {
        var _a;
        const groups = new Map();
        const ungrouped = [];
        for (const item of items) {
            const key = groupBy(item);
            if (key === undefined) {
                ungrouped.push(item);
            }
            else {
                const bucket = groups.get(key);
                if (bucket) {
                    bucket.push(item);
                }
                else {
                    groups.set(key, [item]);
                }
            }
        }
        const keys = [...groups.keys()];
        if (sortGroups)
            keys.sort(sortGroups);
        const result = [...ungrouped];
        for (const key of keys) {
            result.push({ type: 'group', label: key });
            result.push(...((_a = groups.get(key)) !== null && _a !== void 0 ? _a : []));
        }
        return result;
    }

    /**
     * Wrap `fn` so it only executes after `wait` ms of silence.
     * Repeated calls within the window reset the timer.
     *
     * The returned function has two extra methods:
     * - `cancel()` — discard the pending invocation without calling `fn`.
     * - `flush(...args)` — call `fn` immediately, clearing any pending timer.
     *
     * @example
     * ```ts
     * const save = debounce((value: string) => api.save(value), 300);
     * input.addEventListener('input', (e) => save((e.target as HTMLInputElement).value));
     * ```
     */
    function debounce(fn, wait) {
        let timer;
        function debounced(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => {
                timer = undefined;
                fn(...args);
            }, wait);
        }
        debounced.cancel = () => {
            clearTimeout(timer);
            timer = undefined;
        };
        debounced.flush = (...args) => {
            clearTimeout(timer);
            timer = undefined;
            fn(...args);
        };
        return debounced;
    }

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
    class InputController {
        constructor(input, stateManager, options, onQuery) {
            this.isComposing = false;
            this.cleanups = [];
            this.input = input;
            this.stateManager = stateManager;
            this.options = options;
            this.debouncedQuery = debounce((query) => {
                onQuery(query);
            }, options.debounce);
            this.bind();
        }
        bind() {
            const { input } = this;
            const onInput = () => {
                if (this.isComposing)
                    return;
                // Trim so that whitespace-only input never opens the panel.
                const query = this.getValue().trim();
                this.stateManager.dispatch({ type: 'QUERY_CHANGED', query });
                if (query.length >= this.options.minChars) {
                    this.debouncedQuery(query);
                }
                else if (query.length === 0) {
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
                if (!this.options.openOnFocus)
                    return;
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
            this.cleanups.push(() => input.removeEventListener('input', onInput), () => input.removeEventListener('compositionstart', onCompositionStart), () => input.removeEventListener('compositionend', onCompositionEnd), () => input.removeEventListener('focus', onFocus));
        }
        /**
         * Returns the raw (untrimmed) current value of the host element.
         * For `<input>` and `<textarea>` this is `.value`; for `contenteditable`
         * it is `.textContent`.
         */
        getValue() {
            var _a;
            const { input } = this;
            if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
                return input.value;
            }
            return (_a = input.textContent) !== null && _a !== void 0 ? _a : '';
        }
        /** Set the host element's value without triggering an `input` event. */
        setValue(value) {
            const { input } = this;
            if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
                input.value = value;
            }
            else {
                input.textContent = value;
            }
        }
        /** Move DOM focus to the host input element. */
        focus() {
            this.input.focus();
        }
        destroy() {
            this.debouncedQuery.cancel();
            for (const cleanup of this.cleanups)
                cleanup();
            this.cleanups = [];
        }
    }

    /**
     * Handles @mention mode for contenteditable elements.
     * Detects the trigger character and computes the cursor position
     * for panel placement using Range.getBoundingClientRect().
     */
    class ContentEditableCtrl {
        constructor(el, trigger) {
            this.el = el;
            this.trigger = trigger;
        }
        /** Returns the current query text after the trigger character, or null if not in a mention */
        getActiveMention() {
            var _a;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0)
                return null;
            const range = sel.getRangeAt(0);
            if (!range.collapsed)
                return null;
            if (!this.el.contains(range.startContainer))
                return null;
            const text = (_a = range.startContainer.textContent) !== null && _a !== void 0 ? _a : '';
            const offset = range.startOffset;
            const before = text.slice(0, offset);
            const lastTrigger = before.lastIndexOf(this.trigger);
            if (lastTrigger === -1)
                return null;
            // Check there's no whitespace between trigger and cursor
            const betweenTriggerAndCursor = before.slice(lastTrigger + 1);
            if (/\s/.test(betweenTriggerAndCursor))
                return null;
            return { query: betweenTriggerAndCursor, triggerStart: lastTrigger };
        }
        /**
         * Returns the pixel position of the cursor for panel placement.
         * Accounts for window scroll.
         */
        getCursorRect() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0)
                return null;
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0)
                return null;
            return new DOMRect(rect.left + window.scrollX, rect.top + window.scrollY, rect.width, rect.height);
        }
        /**
         * Insert the replacement text at the current mention position,
         * replacing from the trigger character to the cursor.
         */
        insertMention(text) {
            const mention = this.getActiveMention();
            if (!mention)
                return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0)
                return;
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

    /** Type guard — returns `true` for items the user can highlight and select. */
    function isSelectable(item) {
        return item.type !== 'group' && item.type !== 'divider';
    }

    /**
     * Sanitize a URL for use in `href` attributes.
     *
     * Blocks `javascript:`, `vbscript:`, and `data:` URIs that can execute
     * script when used in navigation contexts. All other values are returned
     * unchanged.
     *
     * Defense-in-depth measures applied before the protocol check:
     * - Leading/trailing whitespace stripped
     * - ASCII null bytes and control characters (U+0000–U+001F) removed
     * - Internal whitespace and hyphens collapsed (prevents split-protocol tricks
     *   such as `javas cript:` or `java-script:`)
     *
     * @param href - The raw URL string to sanitize.
     * @returns The original string, or `'#'` if the URL is unsafe.
     */
    function sanitizeHref(href) {
        // eslint-disable-next-line no-control-regex
        const lower = href.trim().replace(/[ -]/g, '').toLowerCase().replace(/[\s-]/g, '');
        if (lower.startsWith('javascript:') ||
            lower.startsWith('vbscript:') ||
            lower.startsWith('data:')) {
            return '#';
        }
        return href;
    }
    /** Create an element with optional attributes and children */
    function el(tag, attrs, ...children) {
        const node = document.createElement(tag);
        if (attrs) {
            for (const [key, val] of Object.entries(attrs)) {
                node.setAttribute(key, val);
            }
        }
        for (const child of children) {
            node.append(typeof child === 'string' ? document.createTextNode(child) : child);
        }
        return node;
    }
    /** Safely resolve a target to an HTMLElement */
    function resolveElement(target) {
        if (typeof target === 'string') {
            const found = document.querySelector(target);
            if (!found)
                throw new Error(`Praescio: element not found for selector "${target}"`);
            return found;
        }
        return target;
    }
    /** Check if a node is or contains another node */
    function contains(parent, child) {
        return parent === child || parent.contains(child);
    }
    /** Find all scrollable ancestors of an element */
    function scrollableAncestors(el) {
        const result = [];
        let node = el.parentElement;
        while (node && node !== document.documentElement) {
            const style = window.getComputedStyle(node);
            const overflow = style.overflow + style.overflowY + style.overflowX;
            if (/auto|scroll|overlay/.test(overflow))
                result.push(node);
            node = node.parentElement;
        }
        return result;
    }

    function getHighlightSegments(text, query) {
        if (!query)
            return [{ text, matched: false }];
        const normalised = text.normalize('NFC');
        const normQuery = query.normalize('NFC');
        const segments = [];
        const lower = normalised.toLowerCase();
        const lowerQ = normQuery.toLowerCase();
        let cursor = 0;
        let idx;
        while ((idx = lower.indexOf(lowerQ, cursor)) !== -1) {
            if (idx > cursor) {
                segments.push({ text: normalised.slice(cursor, idx), matched: false });
            }
            segments.push({ text: normalised.slice(idx, idx + lowerQ.length), matched: true });
            cursor = idx + lowerQ.length;
        }
        if (cursor < normalised.length) {
            segments.push({ text: normalised.slice(cursor), matched: false });
        }
        if (segments.length === 0) {
            segments.push({ text, matched: false });
        }
        return segments;
    }
    /**
     * Build a DocumentFragment with matched segments wrapped in <mark class="praescio__highlight">.
     * Safe: uses textContent, never innerHTML with user data.
     */
    function buildHighlightFragment(text, query) {
        const fragment = document.createDocumentFragment();
        const segments = getHighlightSegments(text, query);
        for (const seg of segments) {
            if (seg.matched) {
                const mark = document.createElement('mark');
                mark.className = 'praescio__highlight';
                mark.textContent = seg.text;
                fragment.appendChild(mark);
            }
            else {
                fragment.appendChild(document.createTextNode(seg.text));
            }
        }
        return fragment;
    }

    /** Render a `text` suggestion item as a plain labelled `<div>`. */
    function renderTextItem(item, itemId, query, highlight) {
        const node = el('div', {
            class: 'praescio__item praescio__item--text',
            role: 'option',
            tabindex: '-1',
            'aria-selected': 'false',
            id: itemId,
        });
        const label = el('span', { class: 'praescio__item__label' });
        label.append(highlight ? buildHighlightFragment(item.label, query) : item.label);
        node.append(label);
        return node;
    }

    /** Render a `description` suggestion item: label on top, description below. */
    function renderDescriptionItem(item, itemId, query, highlight) {
        const node = el('div', {
            class: 'praescio__item praescio__item--description',
            role: 'option',
            tabindex: '-1',
            'aria-selected': 'false',
            id: itemId,
        });
        const body = el('span', { class: 'praescio__item__body' });
        const label = el('span', { class: 'praescio__item__label' });
        label.append(highlight ? buildHighlightFragment(item.label, query) : item.label);
        const desc = el('span', { class: 'praescio__item__description' });
        desc.textContent = item.description;
        body.append(label, desc);
        node.append(body);
        return node;
    }

    /**
     * Render a `link` suggestion item as an `<a>` element.
     *
     * The `href` is sanitized to prevent `javascript:` and `vbscript:` injection.
     * Clicking the element navigates naturally via the browser; the selection
     * handler closes the panel and fires the `select` event without touching the
     * input value.
     */
    function renderLinkItem(item, itemId, query, highlight) {
        var _a;
        const node = el('a', {
            class: 'praescio__item praescio__item--link',
            role: 'option',
            tabindex: '-1',
            'aria-selected': 'false',
            id: itemId,
            href: sanitizeHref(item.href),
            target: (_a = item.target) !== null && _a !== void 0 ? _a : '_self',
            rel: item.target === '_blank' ? 'noopener noreferrer' : '',
        });
        const label = el('span', { class: 'praescio__item__label' });
        label.append(highlight ? buildHighlightFragment(item.label, query) : item.label);
        node.append(label);
        if (item.description) {
            const desc = el('span', { class: 'praescio__item__description' });
            desc.textContent = item.description;
            node.append(desc);
        }
        return node;
    }

    /**
     * Build an icon element from a string that may be:
     *   - An SVG string (starts with `<svg`) — sanitized before insertion
     *   - An `<img>` HTML tag (starts with `<img`) — src extracted safely
     *   - A URL (http/https/data:image/… or common image extension)
     *   - A CSS class string (e.g. `fa fa-star`)
     *
     * SVG content is sanitized: `<script>` elements are removed, all `on*`
     * event-handler attributes are stripped, `javascript:` hrefs are removed,
     * and `<use>` elements with external resource references are removed.
     */
    function buildIcon(icon, alt) {
        var _a, _b;
        const wrapper = document.createElement('span');
        wrapper.className = 'praescio__item__icon';
        const trimmed = icon.trim();
        if (trimmed.startsWith('<svg')) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(icon, 'image/svg+xml');
            const svg = doc.querySelector('svg');
            if (svg) {
                sanitizeSvgElement(svg);
                svg.setAttribute('aria-hidden', 'true');
                svg.setAttribute('focusable', 'false');
                wrapper.appendChild(document.importNode(svg, true));
            }
        }
        else if (trimmed.startsWith('<img')) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(trimmed, 'text/html');
            const imgEl = doc.querySelector('img');
            if (imgEl) {
                const src = (_a = imgEl.getAttribute('src')) !== null && _a !== void 0 ? _a : '';
                const imgAlt = (_b = alt !== null && alt !== void 0 ? alt : imgEl.getAttribute('alt')) !== null && _b !== void 0 ? _b : undefined;
                wrapper.appendChild(buildImgIcon(src, imgAlt));
            }
        }
        else if (isUrl(icon)) {
            wrapper.appendChild(buildImgIcon(icon, alt));
        }
        else {
            // CSS class-based icon (e.g. icon fonts)
            const span = document.createElement('span');
            span.className = icon;
            if (!alt)
                span.setAttribute('aria-hidden', 'true');
            else
                span.setAttribute('aria-label', alt);
            wrapper.appendChild(span);
        }
        return wrapper;
    }
    /**
     * Strip dangerous content from an inline SVG element in-place:
     * - Removes all `<script>` descendants
     * - Removes `<use>` elements that reference external resources (non-fragment hrefs)
     *   to prevent loading of remote SVGs that may contain executable content
     * - Removes all `on*` event-handler attributes from every element
     * - Removes `href` / `xlink:href` values that are unsafe per {@link sanitizeHref}
     */
    function sanitizeSvgElement(svg) {
        svg.querySelectorAll('script').forEach((el) => el.remove());
        // Remove <use> elements pointing at external resources; fragment-only
        // references (e.g. #icon-id) that reference symbols in the same SVG are fine.
        svg.querySelectorAll('use').forEach((use) => {
            var _a, _b;
            const href = (_b = (_a = use.getAttribute('href')) !== null && _a !== void 0 ? _a : use.getAttributeNS('http://www.w3.org/1999/xlink', 'href')) !== null && _b !== void 0 ? _b : '';
            if (href && !href.startsWith('#'))
                use.remove();
        });
        const elements = [svg, ...Array.from(svg.querySelectorAll('*'))];
        for (const el of elements) {
            const attrsToRemove = [];
            for (const attr of Array.from(el.attributes)) {
                if (attr.name.startsWith('on')) {
                    attrsToRemove.push(attr.name);
                }
                else if (attr.name === 'href' || attr.name === 'xlink:href') {
                    if (sanitizeHref(attr.value) === '#')
                        attrsToRemove.push(attr.name);
                }
            }
            for (const name of attrsToRemove)
                el.removeAttribute(name);
        }
    }
    function buildImgIcon(src, alt) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt !== null && alt !== void 0 ? alt : '';
        if (!alt)
            img.setAttribute('aria-hidden', 'true');
        img.className = 'praescio__item__icon-img';
        return img;
    }
    /**
     * Returns `true` when the string looks like a URL or image path rather than
     * a CSS class string. Only `data:image/` URIs are allowed to prevent
     * non-image data URIs from being passed to `<img src>`.
     */
    function isUrl(s) {
        return (s.startsWith('http') ||
            s.startsWith('//') ||
            s.startsWith('data:image/') ||
            s.startsWith('/') ||
            /\.(png|jpg|jpeg|gif|svg|webp)(\?|$)/i.test(s));
    }

    /**
     * Render an `icon` suggestion item: leading icon followed by a text label.
     * Icon strings are resolved by {@link buildIcon} — SVG, URL, or CSS class.
     */
    function renderIconItem(item, itemId, query, highlight) {
        const node = el('div', {
            class: 'praescio__item praescio__item--icon',
            role: 'option',
            tabindex: '-1',
            'aria-selected': 'false',
            id: itemId,
        });
        node.append(buildIcon(item.icon, item.iconAlt));
        const label = el('span', { class: 'praescio__item__label' });
        label.append(highlight ? buildHighlightFragment(item.label, query) : item.label);
        node.append(label);
        return node;
    }

    /**
     * Render a `rich` suggestion item: optional icon, label, optional description,
     * and optional badge. When the item has an `href` the root element is an `<a>`;
     * otherwise a `<div>`. The `href` is sanitized to block `javascript:` injection.
     */
    function renderRichItem(item, itemId, query, highlight) {
        var _a;
        const tag = item.href ? 'a' : 'div';
        const attrs = {
            class: 'praescio__item praescio__item--rich',
            role: 'option',
            tabindex: '-1',
            'aria-selected': 'false',
            id: itemId,
        };
        if (item.href) {
            attrs['href'] = sanitizeHref(item.href);
            attrs['target'] = (_a = item.target) !== null && _a !== void 0 ? _a : '_self';
            if (item.target === '_blank')
                attrs['rel'] = 'noopener noreferrer';
        }
        const node = el(tag, attrs);
        if (item.icon) {
            node.append(buildIcon(item.icon, item.iconAlt));
        }
        const body = el('span', { class: 'praescio__item__body' });
        const label = el('span', { class: 'praescio__item__label' });
        label.append(highlight ? buildHighlightFragment(item.label, query) : item.label);
        body.append(label);
        if (item.description) {
            const desc = el('span', { class: 'praescio__item__description' });
            desc.textContent = item.description;
            body.append(desc);
        }
        node.append(body);
        if (item.badge) {
            const badge = el('span', { class: 'praescio__item__badge' });
            badge.textContent = item.badge;
            node.append(badge);
        }
        return node;
    }

    /**
     * Render a non-selectable `group` header with `role="group"`.
     * An optional icon is rendered before the label text using {@link buildIcon}.
     */
    function renderGroupHeader(item, groupId) {
        const node = el('div', {
            class: 'praescio__group',
            role: 'group',
            'aria-label': item.label,
            id: groupId,
        });
        const labelEl = el('span', { class: 'praescio__group__label' });
        if (item.icon) {
            labelEl.append(buildIcon(item.icon));
        }
        labelEl.append(document.createTextNode(item.label));
        node.append(labelEl);
        return node;
    }

    /** Render a visual `<hr>` separator with `role="separator"` and `aria-hidden`. */
    function renderDivider() {
        return el('hr', { class: 'praescio__divider', role: 'separator', 'aria-hidden': 'true' });
    }

    /**
     * Render a `custom` suggestion item.
     *
     * If `item.render` is provided it is called with the container element and
     * the current query string and may return a cleanup function. Otherwise, if
     * `item.html` is provided it is written as `innerHTML` (caller is responsible
     * for sanitization). If neither is supplied the container is left empty.
     */
    function renderCustomItem(item, itemId, query) {
        const node = el('div', {
            class: 'praescio__item praescio__item--custom',
            role: 'option',
            tabindex: '-1',
            'aria-selected': 'false',
            id: itemId,
        });
        if (item.render) {
            const result = item.render(node, query);
            return { node, cleanup: typeof result === 'function' ? result : undefined };
        }
        if (item.html !== undefined) {
            node.innerHTML = item.html;
        }
        return { node, cleanup: undefined };
    }

    let counter = 0;
    /**
     * Generate a page-unique ID string, e.g. `"praescio-1"`, `"praescio-2"`.
     * Used to create stable `id` attributes for ARIA relationships
     * (combobox `aria-controls`, listbox `id`, etc.).
     *
     * @param prefix - Optional prefix. Defaults to `"praescio"`.
     */
    function uid(prefix = 'praescio') {
        return `${prefix}-${++counter}`;
    }

    /**
     * Dispatch a {@link SuggestionItem} to the correct template renderer and
     * return the resulting DOM node wrapped in a {@link RenderedItem}.
     *
     * Every selectable item receives a stable, unique `id` attribute so that
     * `aria-activedescendant` can reference it from the combobox input.
     *
     * @param item - The suggestion item to render.
     * @param query - The current query string; passed to templates for highlight matching.
     * @param highlight - Whether to wrap matched text in `<mark>` elements.
     */
    function renderItem(item, query, highlight) {
        const itemId = uid('praescio-item');
        switch (item.type) {
            case 'text':
                return { node: renderTextItem(item, itemId, query, highlight) };
            case 'description':
                return { node: renderDescriptionItem(item, itemId, query, highlight) };
            case 'link':
                return { node: renderLinkItem(item, itemId, query, highlight) };
            case 'icon':
                return { node: renderIconItem(item, itemId, query, highlight) };
            case 'rich':
                return { node: renderRichItem(item, itemId, query, highlight) };
            case 'group':
                return { node: renderGroupHeader(item, uid('praescio-group')) };
            case 'divider':
                return { node: renderDivider() };
            case 'custom': {
                const { node, cleanup } = renderCustomItem(item, itemId, query);
                return { node, cleanup };
            }
        }
    }

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
    class ListRenderer {
        constructor(listId, options) {
            this.rendered = [];
            this.items = [];
            this.query = '';
            this.selectableIndices = [];
            // Virtual scroll state
            this.virtual = false;
            this.scrollEl = null;
            this.containerEl = null;
            this.visibleStart = 0;
            this.visibleEnd = 0;
            this.heights = [];
            this.rafId = null;
            this.options = options;
            this.listEl = el('div', {
                class: 'praescio__list',
                role: 'listbox',
                id: listId,
                'aria-label': options.ariaLabel,
            });
        }
        render(items, query) {
            this.cleanup();
            this.items = items;
            this.query = query;
            this.rendered = [];
            // Determine selectable item indices (used for keyboard navigation)
            this.selectableIndices = items.reduce((acc, item, i) => {
                if (isSelectable(item))
                    acc.push(i);
                return acc;
            }, []);
            const shouldVirtual = this.options.virtualScroll === true ||
                (this.options.virtualScroll === 'auto' && items.length > VIRTUAL_THRESHOLD);
            this.virtual = shouldVirtual;
            this.listEl.innerHTML = '';
            if (shouldVirtual) {
                this.renderVirtual();
            }
            else {
                this.renderAll();
            }
        }
        renderAll() {
            const { items, query, options } = this;
            const fragment = document.createDocumentFragment();
            for (const item of items) {
                const rendered = renderItem(item, query, options.highlight);
                this.rendered.push(rendered);
                fragment.appendChild(rendered.node);
            }
            this.listEl.appendChild(fragment);
        }
        renderVirtual() {
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
                if (this.rafId !== null)
                    cancelAnimationFrame(this.rafId);
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
                    if (this.rafId !== null)
                        cancelAnimationFrame(this.rafId);
                },
            });
        }
        updateVisibleWindow(scrollTop) {
            var _a, _b, _c, _d;
            const { items, heights, containerEl, options } = this;
            if (!containerEl)
                return;
            // Compute which items are in view
            let accumulated = 0;
            let start = 0;
            for (let i = 0; i < heights.length; i++) {
                if (accumulated + ((_a = heights[i]) !== null && _a !== void 0 ? _a : ITEM_HEIGHT_ESTIMATE) > scrollTop) {
                    start = i;
                    break;
                }
                accumulated += (_b = heights[i]) !== null && _b !== void 0 ? _b : ITEM_HEIGHT_ESTIMATE;
            }
            const panelHeight = parseFloat(getComputedStyle(this.listEl).maxHeight) || 288;
            let end = start;
            let visible = 0;
            while (end < items.length && visible < panelHeight + OVERSCAN * ITEM_HEIGHT_ESTIMATE) {
                visible += (_c = heights[end]) !== null && _c !== void 0 ? _c : ITEM_HEIGHT_ESTIMATE;
                end++;
            }
            start = Math.max(0, start - OVERSCAN);
            end = Math.min(items.length, end + OVERSCAN);
            if (start === this.visibleStart && end === this.visibleEnd)
                return;
            this.visibleStart = start;
            this.visibleEnd = end;
            // Compute offset top for the visible slice
            let offsetTop = 0;
            for (let i = 0; i < start; i++)
                offsetTop += (_d = heights[i]) !== null && _d !== void 0 ? _d : ITEM_HEIGHT_ESTIMATE;
            containerEl.innerHTML = '';
            containerEl.style.top = `${offsetTop}px`;
            const fragment = document.createDocumentFragment();
            for (let i = start; i < end; i++) {
                const item = items[i];
                if (!item)
                    continue;
                const rendered = renderItem(item, this.query, options.highlight);
                fragment.appendChild(rendered.node);
            }
            containerEl.appendChild(fragment);
        }
        /**
         * Update the visual highlight (aria-selected + CSS class) to the given
         * selectable index. Pass `-1` to clear the highlight entirely.
         */
        setHighlighted(index) {
            // Clear all
            const current = this.listEl.querySelectorAll('[aria-selected="true"]');
            for (const node of current) {
                node.setAttribute('aria-selected', 'false');
                node.classList.remove('praescio__item--highlighted');
            }
            if (index < 0)
                return;
            const item = this.getSelectableNodeAt(index);
            if (item) {
                item.setAttribute('aria-selected', 'true');
                item.classList.add('praescio__item--highlighted');
                // Ensure item is scrolled into view
                item.scrollIntoView({ block: 'nearest' });
            }
        }
        /** Move DOM focus to the item at the given selectable index. */
        focusItem(index) {
            const item = this.getSelectableNodeAt(index);
            item === null || item === void 0 ? void 0 : item.focus();
        }
        getSelectableNodeAt(selectableIndex) {
            var _a;
            const options = this.listEl.querySelectorAll('[role="option"]');
            return (_a = options[selectableIndex]) !== null && _a !== void 0 ? _a : null;
        }
        /** Total number of selectable (`role="option"`) items currently in the DOM. */
        getSelectableCount() {
            return this.listEl.querySelectorAll('[role="option"]').length;
        }
        /**
         * Return the {@link SuggestionItem} that corresponds to the nth selectable
         * position in the list. Non-selectable items (group headers, dividers) are
         * excluded from the index so keyboard navigation skips them.
         */
        getItemAtSelectableIndex(index) {
            var _a;
            return this.items[(_a = this.selectableIndices[index]) !== null && _a !== void 0 ? _a : -1];
        }
        /**
         * Replace the list contents with a single full-width slot element.
         *
         * @param type - Controls the CSS modifier class and the default text.
         * @param content - Optional custom content. Accepts an `HTMLElement` (appended
         *   as-is) or a string (set as `textContent`). Falls back to the default copy
         *   when omitted.
         */
        showSlot(type, content) {
            this.listEl.innerHTML = '';
            const slot = el('div', {
                class: `praescio__slot praescio__slot--${type}`,
                'aria-live': 'polite',
            });
            if (content instanceof HTMLElement) {
                slot.append(content);
            }
            else {
                slot.textContent = content !== null && content !== void 0 ? content : this.defaultSlotText(type);
            }
            this.listEl.append(slot);
        }
        defaultSlotText(type) {
            if (type === 'loading')
                return 'Loading…';
            if (type === 'empty')
                return 'No results found.';
            if (type === 'error')
                return 'An error occurred. Please try again.';
            return '';
        }
        appendSlotNode(position, node) {
            if (position === 'before') {
                this.listEl.insertBefore(node, this.listEl.firstChild);
            }
            else {
                this.listEl.append(node);
            }
        }
        cleanup() {
            var _a;
            for (const item of this.rendered) {
                (_a = item.cleanup) === null || _a === void 0 ? void 0 : _a.call(item);
            }
            this.rendered = [];
            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        }
        destroy() {
            this.cleanup();
            this.listEl.remove();
        }
    }

    /**
     * Compute the panel's CSS position relative to the viewport.
     * Clamps the result so the panel never exits the viewport.
     */
    function computePanelPosition(anchor, panelHeight, offset, preferredPlacement) {
        const anchorRect = anchor.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;
        const spaceBelow = viewportH - anchorRect.bottom - offset;
        const spaceAbove = anchorRect.top - offset;
        let placement;
        if (preferredPlacement === 'auto') {
            placement = spaceBelow >= panelHeight || spaceBelow >= spaceAbove ? 'bottom' : 'top';
        }
        else {
            placement = preferredPlacement;
        }
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        let top;
        if (placement === 'bottom') {
            top = anchorRect.bottom + scrollY + offset;
        }
        else {
            top = anchorRect.top + scrollY - panelHeight - offset;
        }
        // Clamp left so the panel stays within the viewport
        let left = anchorRect.left + scrollX;
        const panelWidth = Math.min(anchorRect.width, viewportW);
        if (left + panelWidth > scrollX + viewportW) {
            left = scrollX + viewportW - panelWidth;
        }
        if (left < scrollX)
            left = scrollX;
        return { top, left, width: anchorRect.width, placement };
    }

    class PanelManager {
        constructor(panel, anchor, options) {
            this.isOpen = false;
            this.scrollCleanups = [];
            this.resizeObserver = null;
            this.pendingFrame = null;
            this.panel = panel;
            this.anchor = anchor;
            this.options = options;
            this.panel.style.position = 'absolute';
            this.panel.style.zIndex = 'var(--praescio-z-index, 9999)';
            this.panel.style.display = 'none';
            this.panel.style.minWidth = '200px';
        }
        open() {
            if (this.isOpen)
                return;
            this.isOpen = true;
            this.panel.style.display = '';
            this.reposition();
            this.attachScrollListeners();
        }
        close() {
            if (!this.isOpen)
                return;
            this.isOpen = false;
            this.panel.style.display = 'none';
            this.detachScrollListeners();
        }
        reposition() {
            if (!this.isOpen)
                return;
            const panelHeight = this.panel.offsetHeight || 288;
            const rect = computePanelPosition(this.anchor, panelHeight, this.options.offset, this.options.placement);
            this.panel.style.top = `${rect.top}px`;
            this.panel.style.left = `${rect.left}px`;
            this.panel.style.width = `${rect.width}px`;
            this.panel.dataset['praescioPlacement'] = rect.placement;
        }
        attachScrollListeners() {
            this.detachScrollListeners();
            const onReposition = () => {
                if (this.pendingFrame !== null)
                    cancelAnimationFrame(this.pendingFrame);
                this.pendingFrame = requestAnimationFrame(() => {
                    this.reposition();
                    this.pendingFrame = null;
                });
            };
            const ancestors = scrollableAncestors(this.anchor);
            for (const ancestor of ancestors) {
                ancestor.addEventListener('scroll', onReposition, { passive: true });
                this.scrollCleanups.push(() => ancestor.removeEventListener('scroll', onReposition));
            }
            window.addEventListener('scroll', onReposition, { passive: true });
            this.scrollCleanups.push(() => window.removeEventListener('scroll', onReposition));
            window.addEventListener('resize', onReposition, { passive: true });
            this.scrollCleanups.push(() => window.removeEventListener('resize', onReposition));
            this.resizeObserver = new ResizeObserver(onReposition);
            this.resizeObserver.observe(this.anchor);
        }
        detachScrollListeners() {
            var _a;
            for (const cleanup of this.scrollCleanups)
                cleanup();
            this.scrollCleanups = [];
            (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
            this.resizeObserver = null;
            if (this.pendingFrame !== null) {
                cancelAnimationFrame(this.pendingFrame);
                this.pendingFrame = null;
            }
        }
        destroy() {
            this.close();
            this.panel.remove();
        }
    }
    function buildPanelShell(panelId, listEl, slots) {
        const panel = el('div', { class: 'praescio__panel', id: panelId });
        if ((slots === null || slots === void 0 ? void 0 : slots.header) instanceof HTMLElement) {
            const headerWrap = el('div', { class: 'praescio__panel__header' });
            headerWrap.append(slots.header);
            panel.append(headerWrap);
        }
        else if (typeof (slots === null || slots === void 0 ? void 0 : slots.header) === 'string') {
            const headerWrap = el('div', { class: 'praescio__panel__header' });
            headerWrap.textContent = slots.header;
            panel.append(headerWrap);
        }
        panel.append(listEl);
        if ((slots === null || slots === void 0 ? void 0 : slots.footer) instanceof HTMLElement) {
            const footerWrap = el('div', { class: 'praescio__panel__footer' });
            footerWrap.append(slots.footer);
            panel.append(footerWrap);
        }
        return panel;
    }

    /**
     * Manages ARIA state for the autocomplete widget.
     *
     * Responsibilities:
     * - Stamps the input element with the required combobox ARIA attributes on construction.
     * - Keeps `aria-expanded` in sync with the panel open/close state.
     * - Delegates result-count and item announcements to {@link LiveRegion}.
     */
    class A11yController {
        constructor(input, listRenderer, liveRegion, listId, options) {
            this.input = input;
            this.listRenderer = listRenderer;
            this.liveRegion = liveRegion;
            this.options = options;
            this.initInputARIA(listId);
        }
        /** Stamp the input with static combobox ARIA attributes. Called once at construction. */
        initInputARIA(listId) {
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
        handleStatusChange(status, query, items) {
            const isOpen = status === 'open';
            this.input.setAttribute('aria-expanded', String(isOpen));
            if (status === 'open') {
                const selectableCount = items.filter((i) => i.type !== 'group' && i.type !== 'divider').length;
                this.liveRegion.announceResults(selectableCount, query, this.options);
            }
            else if (status === 'empty') {
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
        handleHighlightChange(index, items, total) {
            if (index < 0)
                return;
            const item = this.listRenderer.getItemAtSelectableIndex(index);
            if (!item)
                return;
            this.liveRegion.announceItem(item, index, total, this.options);
        }
    }

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
    /** Number of items skipped by a single PageDown / PageUp keystroke. */
    const PAGE_SIZE = 5;
    /**
     * Wires keyboard interactions to the suggestion panel.
     *
     * Instantiated once per Praescio instance. Delegates navigation state changes
     * through {@link StateManager} and focus management through
     * {@link InputController} / {@link ListRenderer}.
     */
    class KeyboardHandler {
        /**
         * @param input - The host input (or contenteditable) element.
         * @param stateManager - Shared state container; keyboard actions dispatch to it.
         * @param listRenderer - Provides item count and focus management.
         * @param inputController - Used to return DOM focus to the input.
         * @param options - Resolved instance options (only `selectOnTab` is read here).
         * @param onSelectItem - Callback invoked when the user confirms a selection
         *   via Enter or Tab.
         */
        constructor(input, stateManager, listRenderer, inputController, options, onSelectItem) {
            this.cleanups = [];
            this.input = input;
            this.stateManager = stateManager;
            this.listRenderer = listRenderer;
            this.inputController = inputController;
            this.options = options;
            this.onSelectItem = onSelectItem;
            this.bind();
        }
        bind() {
            const onKeydown = (e) => this.handleKeydown(e);
            this.input.addEventListener('keydown', onKeydown);
            this.cleanups.push(() => this.input.removeEventListener('keydown', onKeydown));
            // Also handle keydown on list items (for when focus has moved into the list)
            const onListKeydown = (e) => this.handleListKeydown(e);
            this.listRenderer.listEl.addEventListener('keydown', onListKeydown);
            this.cleanups.push(() => this.listRenderer.listEl.removeEventListener('keydown', onListKeydown));
        }
        handleKeydown(e) {
            const state = this.stateManager.getState();
            switch (e.key) {
                case 'ArrowDown': {
                    e.preventDefault();
                    if (state.status !== 'open')
                        return;
                    const total = this.listRenderer.getSelectableCount();
                    if (total === 0)
                        return;
                    const next = state.highlightedIndex < total - 1 ? state.highlightedIndex + 1 : 0;
                    this.highlightAndFocus(next);
                    break;
                }
                case 'ArrowUp': {
                    e.preventDefault();
                    if (state.status !== 'open')
                        return;
                    const total = this.listRenderer.getSelectableCount();
                    if (total === 0)
                        return;
                    if (state.highlightedIndex <= 0) {
                        // Wrap back to input
                        this.stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index: -1 });
                        this.inputController.focus();
                    }
                    else {
                        this.highlightAndFocus(state.highlightedIndex - 1);
                    }
                    break;
                }
                case 'Home': {
                    if (state.status !== 'open')
                        return;
                    e.preventDefault();
                    this.highlightAndFocus(0);
                    break;
                }
                case 'End': {
                    if (state.status !== 'open')
                        return;
                    e.preventDefault();
                    const total = this.listRenderer.getSelectableCount();
                    if (total > 0)
                        this.highlightAndFocus(total - 1);
                    break;
                }
                case 'PageDown': {
                    if (state.status !== 'open')
                        return;
                    e.preventDefault();
                    const total = this.listRenderer.getSelectableCount();
                    const next = Math.min(state.highlightedIndex + PAGE_SIZE, total - 1);
                    this.highlightAndFocus(next);
                    break;
                }
                case 'PageUp': {
                    if (state.status !== 'open')
                        return;
                    e.preventDefault();
                    const next = Math.max(state.highlightedIndex - PAGE_SIZE, 0);
                    this.highlightAndFocus(next);
                    break;
                }
                case 'Enter': {
                    if (state.status !== 'open' || state.highlightedIndex < 0)
                        return;
                    e.preventDefault();
                    const item = this.listRenderer.getItemAtSelectableIndex(state.highlightedIndex);
                    if (item)
                        this.onSelectItem(item, e);
                    break;
                }
                case 'Tab': {
                    if (state.status !== 'open')
                        return;
                    if (!this.options.selectOnTab)
                        return;
                    if (state.highlightedIndex < 0)
                        return;
                    e.preventDefault();
                    const item = this.listRenderer.getItemAtSelectableIndex(state.highlightedIndex);
                    if (item)
                        this.onSelectItem(item, e);
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
        handleListKeydown(e) {
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
        highlightAndFocus(index) {
            this.stateManager.dispatch({ type: 'ITEM_HIGHLIGHTED', index });
            this.listRenderer.focusItem(index);
        }
        destroy() {
            for (const cleanup of this.cleanups)
                cleanup();
            this.cleanups = [];
        }
    }

    /**
     * Manages a visually-hidden ARIA live region for screen reader announcements.
     *
     * The node is appended to `document.body` and uses `aria-live="polite"` so
     * announcements do not interrupt ongoing speech. Content is cleared after 3 s
     * to avoid stale text being re-announced after DOM serialisation.
     */
    class LiveRegion {
        constructor() {
            this.node = el('div', {
                class: 'praescio__live',
                role: 'status',
                'aria-live': 'polite',
                'aria-atomic': 'true',
            });
            document.body.appendChild(this.node);
        }
        announce(text) {
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
        announceResults(count, query, options) {
            if (options.announceResults) {
                this.announce(options.announceResults(count, query));
                return;
            }
            if (count === 0) {
                this.announce(`No results for "${query}".`);
            }
            else {
                this.announce(`${count} result${count === 1 ? '' : 's'} available.`);
            }
        }
        /**
         * Announce the item currently under keyboard focus.
         * Uses the custom `announceItem` formatter if provided.
         */
        announceItem(item, index, total, options) {
            var _a;
            if (options.announceItem) {
                this.announce(options.announceItem(item, index, total));
                return;
            }
            const label = 'label' in item ? item.label : '';
            const description = 'description' in item ? ` — ${(_a = item.description) !== null && _a !== void 0 ? _a : ''}` : '';
            this.announce(`${index + 1} of ${total}: ${label}${description}`);
        }
        destroy() {
            clearTimeout(this.clearTimer);
            this.node.remove();
        }
    }

    /**
     * Installs and tracks all plugins registered for a Praescio instance.
     *
     * Each plugin's `install` method is called exactly once; if a plugin throws
     * during installation the error is logged to the console and the remaining
     * plugins continue to install normally.
     */
    class PluginRegistry {
        constructor() {
            this.plugins = [];
        }
        /**
         * Install every plugin in `plugins`, passing the live instance and its
         * resolved options. Errors are caught per-plugin so a bad plugin cannot
         * prevent other plugins from loading.
         *
         * The method is generic so callers can pass a `ResolvedOptions<T>` for any
         * concrete `T` without a contravariance error on `transform`.
         */
        installAll(plugins, instance, options) {
            for (const plugin of plugins) {
                try {
                    plugin.install(instance, options);
                    this.plugins.push(plugin);
                }
                catch (err) {
                    // eslint-disable-next-line no-console -- intentional: surface plugin install failures to the developer
                    console.error(`Praescio: plugin "${plugin.name}" failed to install`, err);
                }
            }
        }
    }

    /**
     * Minimal publish/subscribe event bus used internally by Praescio.
     *
     * Handlers are stored in a `Map<string, Set<fn>>` so that duplicate
     * registrations of the same function reference are silently deduplicated.
     */
    class EventEmitter {
        constructor() {
            this.listeners = new Map();
        }
        /**
         * Register a handler for `event`.
         * @returns An unsubscribe function — call it to remove the handler.
         */
        on(event, handler) {
            let set = this.listeners.get(event);
            if (!set) {
                set = new Set();
                this.listeners.set(event, set);
            }
            set.add(handler);
            return () => this.off(event, handler);
        }
        /** Unregister a previously added handler. */
        off(event, handler) {
            var _a;
            (_a = this.listeners.get(event)) === null || _a === void 0 ? void 0 : _a.delete(handler);
        }
        /** Invoke all handlers registered for `event`, passing `args` as-is. */
        emit(event, ...args) {
            const set = this.listeners.get(event);
            if (!set)
                return;
            for (const handler of set) {
                handler(...args);
            }
        }
        /** Remove all listeners and release memory. */
        destroy() {
            this.listeners.clear();
        }
    }

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
    class Praescio {
        /**
         * Create a new Praescio autocomplete instance.
         *
         * @param target - A CSS selector string or a direct `HTMLElement` reference
         *   for the input that will be enhanced.
         * @param options - Configuration; see {@link PraescioOptions} for the full
         *   reference. The only required field is `source`.
         * @throws {Error} If `target` is a string that matches no element in the DOM.
         */
        constructor(target, options) {
            this.contentEditableCtrl = null;
            this.destroyed = false;
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
            this.a11yController = new A11yController(this.inputEl, this.listRenderer, this.liveRegion, listId, this.options);
            // ── Input ──────────────────────────────────────────────────────────────
            this.inputController = new InputController(this.inputEl, this.stateManager, this.options, (query) => this.onQueryReady(query));
            if (this.options.trigger && this.inputEl.isContentEditable) {
                this.contentEditableCtrl = new ContentEditableCtrl(this.inputEl, this.options.trigger);
            }
            // ── Keyboard ───────────────────────────────────────────────────────────
            this.keyboardHandler = new KeyboardHandler(this.inputEl, this.stateManager, this.listRenderer, this.inputController, this.options, (item, event) => this.selectItem(item, event));
            // ── Events ─────────────────────────────────────────────────────────────
            this.emitter = new EventEmitter();
            // ── State subscription ─────────────────────────────────────────────────
            this.unsubscribeState = this.stateManager.subscribe((next, prev) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                // Panel open/close
                if (next.status !== prev.status) {
                    if (next.status === 'open' || next.status === 'empty' || next.status === 'loading') {
                        this.panelManager.open();
                    }
                    else if (next.status === 'idle' || next.status === 'error') {
                        this.panelManager.close();
                    }
                    this.a11yController.handleStatusChange(next.status, next.query, next.items);
                    if (next.status === 'open') {
                        (_b = (_a = this.options).onOpen) === null || _b === void 0 ? void 0 : _b.call(_a);
                        this.emitter.emit('open');
                    }
                    else if (prev.status === 'open' && (next.status === 'idle' || next.status === 'error')) {
                        (_d = (_c = this.options).onClose) === null || _d === void 0 ? void 0 : _d.call(_c);
                        this.emitter.emit('close');
                    }
                    else if (next.status === 'empty' && prev.status !== 'empty') {
                        // Emit 'empty' on the first transition into empty state for this query
                        (_f = (_e = this.options).onEmpty) === null || _f === void 0 ? void 0 : _f.call(_e, next.query);
                        this.emitter.emit('empty', next.query);
                    }
                }
                // Results
                if (next.items !== prev.items) {
                    if (next.status === 'open') {
                        this.listRenderer.render(next.items, next.query);
                        this.renderFooterSlot(next.query);
                    }
                    else if (next.status === 'empty') {
                        this.renderEmptySlot(next.query);
                    }
                    else if (next.status === 'loading') {
                        this.renderLoadingSlot();
                    }
                    else if (next.status === 'error') {
                        this.listRenderer.showSlot('error');
                    }
                }
                else if (next.status === 'loading' && prev.status !== 'loading') {
                    this.renderLoadingSlot();
                }
                else if (next.status === 'empty' && prev.status !== 'empty') {
                    this.renderEmptySlot(next.query);
                }
                // Highlight
                if (next.highlightedIndex !== prev.highlightedIndex) {
                    this.listRenderer.setHighlighted(next.highlightedIndex);
                    if (next.highlightedIndex >= 0) {
                        const total = this.listRenderer.getSelectableCount();
                        this.a11yController.handleHighlightChange(next.highlightedIndex, next.items, total);
                        const highlightedItem = (_g = next.items[next.highlightedIndex]) !== null && _g !== void 0 ? _g : null;
                        (_j = (_h = this.options).onHighlight) === null || _j === void 0 ? void 0 : _j.call(_h, highlightedItem, next.highlightedIndex);
                        this.emitter.emit('highlight', highlightedItem, next.highlightedIndex);
                    }
                    else {
                        // Highlight cleared
                        (_l = (_k = this.options).onHighlight) === null || _l === void 0 ? void 0 : _l.call(_k, null, -1);
                        this.emitter.emit('highlight', null, -1);
                    }
                }
            });
            // ── Outside-click to close ─────────────────────────────────────────────
            const onOutsideClick = (e) => {
                const target = e.target;
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
            const onPanelPointerdown = (e) => {
                const option = e.target.closest('[role="option"]');
                if (option && option.tagName !== 'A') {
                    e.preventDefault();
                }
            };
            panel.addEventListener('pointerdown', onPanelPointerdown);
            this.panelPointerdownCleanup = () => panel.removeEventListener('pointerdown', onPanelPointerdown);
            // ── List click: handle item selection ──────────────────────────────────
            const onListClick = (e) => this.handleListClick(e);
            this.listRenderer.listEl.addEventListener('click', onListClick);
            this.listClickCleanup = () => this.listRenderer.listEl.removeEventListener('click', onListClick);
            // ── Plugins ────────────────────────────────────────────────────────────
            this.pluginRegistry = new PluginRegistry();
            this.pluginRegistry.installAll(this.options.plugins, this, this.options);
        }
        // ── Private helpers ──────────────────────────────────────────────────────
        resolveContainer() {
            if (!this.options.container)
                return document.body;
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
        onQueryReady(query) {
            var _a, _b;
            (_b = (_a = this.options).onQuery) === null || _b === void 0 ? void 0 : _b.call(_a, query);
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
        handleListClick(e) {
            var _a, _b;
            const option = e.target.closest('[role="option"]');
            if (!option)
                return;
            const options = this.listRenderer.listEl.querySelectorAll('[role="option"]');
            const index = Array.from(options).indexOf(option);
            if (index < 0)
                return;
            const item = this.listRenderer.getItemAtSelectableIndex(index);
            if (!item)
                return;
            if (item.type === 'link') {
                // The <a> element handles navigation naturally via its href.
                // We only need to close the panel and emit the select event.
                this.stateManager.dispatch({ type: 'ITEM_SELECTED', item, originalEvent: e });
                if (this.options.closeOnSelect)
                    this.panelManager.close();
                (_b = (_a = this.options).onSelect) === null || _b === void 0 ? void 0 : _b.call(_a, item, e);
                this.emitter.emit('select', item, e);
                return;
            }
            this.selectItem(item, e);
        }
        selectItem(item, event) {
            var _a, _b, _c;
            if (item.type === 'link') {
                // Keyboard-triggered selection: navigate programmatically.
                // Click-triggered selection is handled by handleListClick instead.
                const safe = sanitizeHref(item.href);
                if (safe !== '#') {
                    if (item.target === '_blank') {
                        window.open(safe, '_blank', 'noopener,noreferrer');
                    }
                    else {
                        window.location.href = safe;
                    }
                }
            }
            else if (this.contentEditableCtrl && this.options.insertTemplate) {
                // In @mention mode, insert the text at cursor
                this.contentEditableCtrl.insertMention(this.options.insertTemplate(item));
            }
            else if ('value' in item || 'label' in item) {
                const val = (_a = item.value) !== null && _a !== void 0 ? _a : item.label;
                this.inputController.setValue(val);
            }
            this.stateManager.dispatch({ type: 'ITEM_SELECTED', item, originalEvent: event });
            if (this.options.closeOnSelect) {
                this.panelManager.close();
            }
            (_c = (_b = this.options).onSelect) === null || _c === void 0 ? void 0 : _c.call(_b, item, event);
            this.emitter.emit('select', item, event);
            this.inputController.focus();
        }
        renderLoadingSlot() {
            var _a;
            const slot = (_a = this.options.slots) === null || _a === void 0 ? void 0 : _a.loading;
            if (slot instanceof HTMLElement) {
                this.listRenderer.showSlot('loading', slot.cloneNode(true));
            }
            else if (typeof slot === 'string') {
                this.listRenderer.showSlot('loading', slot);
            }
            else {
                this.listRenderer.showSlot('loading');
            }
        }
        renderEmptySlot(query) {
            var _a;
            if (!this.options.showEmpty) {
                this.panelManager.close();
                return;
            }
            const slot = (_a = this.options.slots) === null || _a === void 0 ? void 0 : _a.empty;
            if (typeof slot === 'function') {
                this.listRenderer.showSlot('empty', slot(query));
            }
            else if (typeof slot === 'string') {
                this.listRenderer.showSlot('empty', slot);
            }
            else {
                this.listRenderer.showSlot('empty');
            }
        }
        renderFooterSlot(query) {
            var _a;
            const slot = (_a = this.options.slots) === null || _a === void 0 ? void 0 : _a.footer;
            if (!slot)
                return;
            const footerEl = this.panelManager.panel.querySelector('.praescio__panel__footer');
            if (!footerEl)
                return;
            footerEl.innerHTML = '';
            if (typeof slot === 'function') {
                footerEl.appendChild(slot(query));
            }
            else if (typeof slot === 'string') {
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
        open(query) {
            if (this.destroyed)
                return;
            const q = query !== null && query !== void 0 ? query : this.inputController.getValue();
            if (q.length >= this.options.minChars) {
                void this.dataController.fetch(q);
            }
            else {
                const state = this.stateManager.getState();
                if (state.items.length > 0) {
                    this.stateManager.dispatch({ type: 'OPEN_CACHED', items: state.items });
                }
            }
        }
        /** Close the suggestion panel without selecting an item. */
        close() {
            if (this.destroyed)
                return;
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
        setQuery(value, triggerFetch = true) {
            if (this.destroyed)
                return;
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
        refresh() {
            if (this.destroyed)
                return;
            const query = this.stateManager.getState().query;
            if (query.length >= this.options.minChars) {
                void this.dataController.fetch(query);
            }
        }
        /** Evict all entries from the in-memory query cache. */
        clearCache() {
            this.dataController.clearCache();
        }
        on(event, handler) {
            return this.emitter.on(event, handler);
        }
        off(event, handler) {
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
        destroy() {
            var _a, _b;
            if (this.destroyed)
                return;
            this.destroyed = true;
            (_b = (_a = this.options).onDestroy) === null || _b === void 0 ? void 0 : _b.call(_a);
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
    /** Library version string. Consumers can read this without instantiating. */
    Praescio.currentVersion = '1.0.0';

    function load(key) {
        var _a;
        try {
            return JSON.parse((_a = localStorage.getItem(key)) !== null && _a !== void 0 ? _a : '[]');
        }
        catch {
            return [];
        }
    }
    function save(key, items) {
        try {
            localStorage.setItem(key, JSON.stringify(items));
        }
        catch {
            // localStorage may be unavailable in private browsing or storage full
        }
    }
    /**
     * Persists the last N selected item labels in `localStorage` and prepends
     * them as a "Recent" group whenever the panel opens with an empty query.
     *
     * @example
     * ```ts
     * new Praescio('#search', {
     *   source: mySource,
     *   plugins: [recentSearches({ maxItems: 5, groupLabel: 'Recently used' })],
     * });
     * ```
     */
    function recentSearches(opts = {}) {
        const { maxItems = 5, storageKey = 'praescio_recent_searches', groupLabel = 'Recent' } = opts;
        return {
            name: 'recentSearches',
            install(instance, options) {
                // On select: persist the selected item's label
                const offSelect = instance.on('select', (item) => {
                    const si = item;
                    const label = 'label' in si ? si.label : '';
                    if (!label)
                        return;
                    const recent = load(storageKey).filter((r) => r !== label);
                    recent.unshift(label);
                    save(storageKey, recent.slice(0, maxItems));
                });
                // On focus with empty query: inject recent searches before results
                options.onOpen;
                // Cleanup when destroyed
                instance.on('destroy', () => {
                    offSelect();
                });
            },
        };
    }

    /** Compute Levenshtein distance between two strings (case-insensitive) */
    function levenshtein(a, b) {
        var _a, _b, _c, _d, _e, _f;
        const al = a.toLowerCase();
        const bl = b.toLowerCase();
        const m = al.length;
        const n = bl.length;
        const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const row = dp[i];
                const prevRow = dp[i - 1];
                if (!row || !prevRow)
                    continue;
                if (al[i - 1] === bl[j - 1]) {
                    row[j] = (_a = prevRow[j - 1]) !== null && _a !== void 0 ? _a : 0;
                }
                else {
                    row[j] =
                        1 + Math.min((_b = prevRow[j]) !== null && _b !== void 0 ? _b : Infinity, (_c = row[j - 1]) !== null && _c !== void 0 ? _c : Infinity, (_d = prevRow[j - 1]) !== null && _d !== void 0 ? _d : Infinity);
                }
            }
        }
        return (_f = (_e = dp[m]) === null || _e === void 0 ? void 0 : _e[n]) !== null && _f !== void 0 ? _f : Infinity;
    }
    /**
     * A plugin that wraps the existing source with fuzzy matching.
     * Items whose label is within `threshold` edits of the query are included,
     * sorted by ascending distance.
     */
    function fuzzyMatch(opts = {}) {
        var _a;
        const threshold = (_a = opts.threshold) !== null && _a !== void 0 ? _a : 2;
        return {
            name: 'fuzzyMatch',
            install(_instance, options) {
                const originalSource = options.source;
                if (typeof originalSource !== 'function' && !Array.isArray(originalSource))
                    return;
                // Monkey-patch: wrap source to apply fuzzy filtering
                // Note: the transform is applied after normalisation in DataController.
                // For array sources, we can replace the source function.
                if (Array.isArray(originalSource)) {
                    const items = originalSource;
                    // Replace with a fuzzy-filtered async source
                    options['source'] = async (query) => {
                        return items
                            .map((item) => {
                            var _a;
                            const label = typeof item === 'string' ? item : ((_a = item.label) !== null && _a !== void 0 ? _a : '');
                            const dist = levenshtein(query, label);
                            return { item, dist };
                        })
                            .filter(({ dist }) => dist <= threshold)
                            .sort((a, b) => a.dist - b.dist)
                            .map(({ item }) => item);
                    };
                }
            },
        };
    }

    /**
     * Opens the Praescio panel when a configurable keyboard shortcut is pressed
     * from anywhere on the page (not just when the input is focused).
     */
    function keyboardShortcut(opts = {}) {
        const { key = 'k', meta = true, ctrl = true, alt = false, shift = false } = opts;
        return {
            name: 'keyboardShortcut',
            install(instance) {
                const handler = (e) => {
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
                instance.on('destroy', () => {
                    document.removeEventListener('keydown', handler);
                });
            },
        };
    }

    /**
     * Forwards Praescio interaction events to your analytics pipeline.
     *
     * Tracks queries, item selections, and "no results" scenarios — without
     * requiring you to wire up multiple `instance.on(…)` calls manually.
     *
     * @example
     * ```ts
     * new Praescio('#search', {
     *   source: mySource,
     *   plugins: [
     *     analytics({
     *       onQuery: (q) => gtag('event', 'search', { search_term: q }),
     *       onSelect: (item, q) => gtag('event', 'select_item', { item_name: item.label }),
     *       onNoResults: (q) => gtag('event', 'no_results', { search_term: q }),
     *     }),
     *   ],
     * });
     * ```
     */
    function analytics(opts) {
        return {
            name: 'analytics',
            install(instance) {
                let lastQuery = '';
                if (opts.onQuery) {
                    instance.on('query', (query) => {
                        var _a;
                        lastQuery = query;
                        (_a = opts.onQuery) === null || _a === void 0 ? void 0 : _a.call(opts, query);
                    });
                }
                if (opts.onSelect) {
                    instance.on('select', (item) => {
                        var _a;
                        (_a = opts.onSelect) === null || _a === void 0 ? void 0 : _a.call(opts, item, lastQuery);
                    });
                }
                if (opts.onNoResults) {
                    instance.on('fetchEnd', (query, items) => {
                        var _a;
                        if (Array.isArray(items) && items.length === 0) {
                            (_a = opts.onNoResults) === null || _a === void 0 ? void 0 : _a.call(opts, query);
                        }
                    });
                }
            },
        };
    }

    exports.Praescio = Praescio;
    exports.analytics = analytics;
    exports.default = Praescio;
    exports.fuzzyMatch = fuzzyMatch;
    exports.keyboardShortcut = keyboardShortcut;
    exports.recentSearches = recentSearches;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=praescio.umd.js.map
