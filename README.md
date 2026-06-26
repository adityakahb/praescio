# Praescio

**v1.0.0** — *praescio* (Latin) — to know in advance.

A zero-dependency, TypeScript-first autocomplete / typeahead library for the web. Ships as ESM, CJS, UMD, and a CDN-ready minified bundle with full `.d.ts` declarations.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Browser Support](#browser-support)
- [Build Outputs](#build-outputs)
- [Quick Start](#quick-start)
- [Item Types](#item-types)
- [Options Reference](#options-reference)
- [Events & Callbacks](#events--callbacks)
- [Public API](#public-api)
- [Slots](#slots)
- [Plugins](#plugins)
- [CSS & Theming](#css--theming)
- [Print Support](#print-support)
- [Framework Connectors](#framework-connectors)
- [CDN Usage](#cdn-usage)
- [Security](#security)
- [Demos](#demos)
- [Development](#development)

---

## Features

- **TypeScript-first** — full generics, discriminated union item types, strict typings throughout
- **Rich items built-in** — text, description, icon, rich (icon + badge), link, group headers, dividers, custom render
- **Async-safe** — request sequencing with `AbortController`; stale results are never shown
- **Three cache strategies** — `none`, `query`, `stale-while-revalidate`
- **Accessible** — WAI-ARIA 1.2 combobox pattern, real `focus()` management (not `aria-activedescendant`), live region announcements
- **`contenteditable` / @mention mode** — trigger character support with cursor-position-aware insertion
- **Plugin system** — bundled plugins for recent searches, fuzzy matching, keyboard shortcuts, analytics
- **`minChars`** — configurable minimum character threshold before the typeahead fires
- **CSS custom properties** — zero-specificity theming; dark mode via `prefers-color-scheme` out of the box
- **Print support** — `@media print` styles automatically hide the dropdown panel
- **Multiple output formats** — ESM, CJS, UMD, CDN IIFE, `.d.ts`
- **Security-hardened** — `href` values sanitized against `javascript:`/`vbscript:`/`data:` injection (including split-protocol tricks); inline SVG icons stripped of `<script>` tags, `on*` handlers, and external `<use>` references; `data:text/html` icons rejected

---

## Installation

```bash
npm install praescio
```

Import the stylesheet once in your application:

```ts
import 'praescio/css';
```

Or link directly:

```html
<link rel="stylesheet" href="node_modules/praescio/dist/styles/praescio.css" />
```

---

## Browser Support

Praescio targets modern browsers (last 2 major versions):

| Browser | Minimum version |
|---------|----------------|
| Chrome / Edge | 112+ |
| Firefox | 117+ |
| Safari | 16.5+ |

CSS custom properties are required. There is no IE11 support.

For broader compatibility, use the UMD build (`dist/scripts/praescio.umd.js`) which works with AMD loaders, CommonJS, and browser globals.

---

## Build Outputs

| File | Format | Source map |
|------|--------|-----------|
| `dist/scripts/praescio.esm.js` | ESM | ✅ `.map` |
| `dist/scripts/praescio.esm.min.js` | ESM minified | — |
| `dist/scripts/praescio.cjs.js` | CommonJS | ✅ `.map` |
| `dist/scripts/praescio.cjs.min.js` | CJS minified | — |
| `dist/scripts/praescio.umd.js` | UMD | ✅ `.map` |
| `dist/scripts/praescio.umd.min.js` | UMD minified | — |
| `dist/scripts/praescio.min.js` | IIFE (CDN) | — |
| `dist/scripts/praescio-connectors.esm.js` | Connectors ESM | ✅ `.map` |
| `dist/scripts/praescio-connectors.esm.min.js` | Connectors ESM minified | — |
| `dist/styles/praescio.css` | CSS | — |
| `dist/styles/praescio.min.css` | CSS minified | — |
| `dist/praescio.d.ts` | TypeScript declarations | — |
| `dist/praescio-connectors.d.ts` | Connector declarations | — |

Source maps use `inlineSources: true` — the original TypeScript is embedded in the `.map` file so debuggers work without access to the `src/` directory.

---

## Quick Start

```ts
import Praescio from 'praescio';
import 'praescio/css';

const ac = new Praescio('#search', {
  source: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'],
});
```

### Async source

```ts
const ac = new Praescio<{ id: number; name: string }>('#search', {
  source: async (query, signal) => {
    const res = await fetch(`/api/items?q=${query}`, { signal });
    return res.json();
  },
  transform: (raw) => ({ type: 'text', label: raw.name, value: String(raw.id) }),
  debounce: 200,
  minChars: 2,
  onSelect: (item) => console.log('selected', item.label),
});
```

### URL template source

```ts
new Praescio('#search', {
  source: 'https://api.example.com/suggest?q={query}',
  // Response must be a JSON array. {query} is replaced with encodeURIComponent(query).
});
```

---

## Item Types

Praescio uses a **discriminated union** — the `type` field controls rendering:

| Type | Description |
|------|-------------|
| `text` | Plain label |
| `description` | Label + secondary description line |
| `link` | Label + `href`; rendered as `<a>` that navigates on click/Enter |
| `icon` | Label + leading icon (SVG string, URL, or icon-font class) |
| `rich` | Icon + label + description + optional badge + optional href |
| `group` | Non-selectable section header |
| `divider` | Horizontal rule |
| `custom` | Consumer-supplied `render(container, query)` callback **or** `html` string for inline markup |

```ts
const items: SuggestionItem[] = [
  { type: 'group',       label: 'Recent' },
  { type: 'text',        label: 'Apple',     value: 'apple' },
  { type: 'description', label: 'TypeScript', description: 'Typed superset of JavaScript' },
  // Link items navigate to href on click/Enter — they do NOT populate the input
  { type: 'link',        label: 'Docs',       href: '/docs',  target: '_blank' },
  { type: 'icon',        label: 'Settings',   icon: '<svg>…</svg>' },
  { type: 'rich',        label: 'John Doe',   description: 'Engineering', badge: 'Admin', icon: '/avatars/john.jpg' },
  { type: 'divider' },
  // Custom item — render callback (full control, cleanup supported)
  {
    type: 'custom',
    label: 'Create entry',
    render(el, query) {
      el.innerHTML = `<strong>+ Create "${query}"</strong>`;
    },
  },
  // Custom item — html shorthand (image + text; developer is responsible for sanitizing)
  {
    type: 'custom',
    label: 'Acme Corp',
    value: 'acme',
    html: '<img src="/logos/acme.png" alt="Acme logo" style="width:24px;height:24px;border-radius:4px"> Acme Corp',
  },
];
```

### Link item navigation

`link` items render as `<a>` elements:

- **Click** — the browser follows `href` normally; the panel closes and the `select` event fires, but the input value is **not** changed.
- **Keyboard `Enter`** — navigates via `window.location` (or `window.open` for `target: '_blank'`).
- **Security** — `href` values beginning with `javascript:` or `vbscript:` are replaced with `'#'` at render time.

### Custom markup with `html`

The `html` shorthand on `custom` items lets you set arbitrary inner markup — useful for items containing images, badges, or structured layouts — without writing a full `render` callback:

```ts
{
  type: 'custom',
  label: 'Product name',   // used by screen readers and keyboard navigation
  value: 'product-id',
  html: '<img src="/img/product.jpg" alt=""> <span>Product name <em>$9.99</em></span>',
}
```

> **Security note:** `html` is written directly as `innerHTML`. Never interpolate unescaped user input. For dynamic content, use the `render` callback instead.

---

## Options Reference

```ts
new Praescio(target, options)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `source` | `T[] \| DataSourceFn<T> \| string` | — | **Required.** Array, async function, or URL template |
| `transform` | `(raw: T) => SuggestionItem` | — | Coerce raw items to `SuggestionItem` |
| `groupBy` | `(item) => string \| undefined` | — | Group items; return `undefined` for ungrouped |
| `sortGroups` | `(a, b) => number` | insertion order | Comparator for group ordering |
| `debounce` | `number` | `300` | Input debounce in ms |
| `minChars` | `number` | `1` | Minimum non-whitespace characters before the typeahead fires (value is trimmed before the check) |
| `maxItems` | `number` | `10` | Max items shown; `0` = unlimited |
| `cache` | `'none' \| 'query' \| 'stale-while-revalidate'` | `'query'` | Cache strategy |
| `cacheTTL` | `number` | `300_000` | Cache TTL in ms (5 min) |
| `selectOnTab` | `boolean` | `true` | Select highlighted item on Tab |
| `closeOnSelect` | `boolean` | `true` | Close panel after selection |
| `openOnFocus` | `boolean` | `false` | Show cached results on input re-focus |
| `highlight` | `boolean` | `true` | Wrap matched characters in `<mark>` |
| `showEmpty` | `boolean` | `true` | Show the empty slot when there are no results |
| `virtualScroll` | `boolean \| 'auto'` | `'auto'` | Enable virtual scrolling (auto when results > 100) |
| `placement` | `'bottom' \| 'top' \| 'auto'` | `'auto'` | Panel position relative to the input |
| `offset` | `number` | `4` | Gap (px) between input and panel |
| `container` | `HTMLElement \| string` | `document.body` | Element the panel is appended to |
| `trigger` | `string` | — | Trigger character for `contenteditable` @mention mode (e.g. `'@'`) |
| `insertTemplate` | `(item) => string` | — | Text inserted on selection in @mention mode |
| `ariaLabel` | `string` | `'Suggestions'` | `aria-label` for the listbox |
| `announceResults` | `(count, query) => string` | — | Custom screen-reader announcement when results load |
| `announceItem` | `(item, index, total) => string` | — | Custom announcement for each highlighted item |
| `plugins` | `PraescioPlugin[]` | `[]` | Plugins to install |
| `slots` | `PraescioSlots` | — | Custom content for empty, loading, header, footer regions |

---

## Events & Callbacks

Every event can be observed two ways — as an **option callback** set at construction time, or via the **`.on()` / `.off()` API** which can be added or removed at any time.

### Full event reference

| Event | Callback option | Payload | Description |
|-------|-----------------|---------|-------------|
| `open` | `onOpen` | — | Panel opened |
| `close` | `onClose` | — | Panel closed |
| `select` | `onSelect` | `(item, originalEvent)` | User selected an item |
| `query` | `onQuery` | `(query)` | Debounced input changed (after `minChars`) |
| `fetchStart` | `onFetchStart` | `(query)` | Fetch started |
| `fetchEnd` | `onFetchEnd` | `(query, items)` | Fetch completed with results |
| `fetchError` | `onFetchError` | `(query, error)` | Fetch threw an error |
| `highlight` | `onHighlight` | `(item \| null, index)` | Keyboard navigation moved to a new item; `null` / `-1` when cleared |
| `empty` | `onEmpty` | `(query)` | Fetch returned zero results |
| `destroy` | `onDestroy` | — | Instance is being torn down |

### Option callbacks

```ts
new Praescio('#search', {
  source: mySource,
  onOpen:       ()                      => console.log('panel opened'),
  onClose:      ()                      => console.log('panel closed'),
  onSelect:     (item, event)           => console.log('selected', item.label),
  onQuery:      (query)                 => console.log('query', query),
  onFetchStart: (query)                 => showSpinner(),
  onFetchEnd:   (query, items)          => hideSpinner(),
  onFetchError: (query, error)          => reportError(error),
  onHighlight:  (item, index)           => item && previewItem(item),
  onEmpty:      (query)                 => logNoResults(query),
  onDestroy:    ()                      => console.log('instance destroyed'),
});
```

### `.on()` / `.off()` API

```ts
const ac = new Praescio('#search', { source: mySource });

// Subscribe — returns an unsubscribe function
const offHighlight = ac.on('highlight', (item, index) => {
  if (item) previewPane.render(item);
});

// Unsubscribe by calling the returned function
offHighlight();

// Or unsubscribe by reference
const handler = (query: string) => console.log('empty for:', query);
ac.on('empty', handler);
ac.off('empty', handler);
```

---

## Public API

```ts
// Static (no instance needed)
Praescio.currentVersion          // e.g. '1.0.0'

// Instance methods
ac.open(query?)                  // Programmatically open the panel
ac.close()                       // Close the panel
ac.setQuery(value, triggerFetch?) // Set input value, optionally trigger fetch
ac.refresh()                     // Re-fetch with the current query (bypasses cache)
ac.clearCache()                  // Evict all in-memory cache entries
ac.on(event, handler)            // Subscribe to an event; returns unsubscribe fn
ac.off(event, handler)           // Unsubscribe a handler
ac.destroy()                     // Tear down — removes DOM, listeners, ARIA attrs
```

---

## Slots

Customise the panel's empty, loading, header, and footer regions:

```ts
new Praescio('#search', {
  source: mySource,
  slots: {
    // String (rendered as text node)
    loading: 'Searching…',

    // HTMLElement (cloned on each display)
    loading: (() => {
      const el = document.createElement('div');
      el.textContent = 'Searching…';
      return el;
    })(),

    // Function receiving current query (empty / footer only)
    empty: (query) => {
      const el = document.createElement('p');
      el.textContent = `No results for "${query}"`;
      return el;
    },

    footer: (query) => {
      const a = document.createElement('a');
      a.href = `/search?q=${encodeURIComponent(query)}`;
      a.textContent = `See all results for "${query}"`;
      return a;
    },

    // Static header above the list
    header: '<div class="panel-header">Top results</div>',
  },
});
```

---

## Plugins

### `recentSearches`

Persists the last N selected labels in `localStorage` and shows them as a group on open.

```ts
import { recentSearches } from 'praescio';

new Praescio('#search', {
  source: mySource,
  plugins: [recentSearches({ maxItems: 5, groupLabel: 'Recently used' })],
});
```

### `fuzzyMatch`

Wraps the array source with Levenshtein-distance filtering so typos still return results.

```ts
import { fuzzyMatch } from 'praescio';

new Praescio('#search', {
  source: ['TypeScript', 'JavaScript', 'Python', 'Rust'],
  plugins: [fuzzyMatch({ threshold: 2 })],
  // "Typscript" → ["TypeScript"]
});
```

### `keyboardShortcut`

Opens the panel from anywhere on the page via a configurable key combination.

```ts
import { keyboardShortcut } from 'praescio';

new Praescio('#search', {
  source: mySource,
  plugins: [keyboardShortcut({ key: 'k' })], // Cmd+K / Ctrl+K
});
```

### `analytics`

Forwards interaction events to your analytics pipeline.

```ts
import { analytics } from 'praescio';

new Praescio('#search', {
  source: mySource,
  plugins: [
    analytics({
      onQuery:     (q)        => gtag('event', 'search',     { search_term: q }),
      onSelect:    (item, q)  => gtag('event', 'select_item', { item_name: item.label }),
      onNoResults: (q)        => gtag('event', 'no_results',  { search_term: q }),
    }),
  ],
});
```

---

## CSS & Theming

Import the stylesheet once in your application:

```ts
import 'praescio/css';
```

Or link directly:

```html
<link rel="stylesheet" href="node_modules/praescio/dist/styles/praescio.css" />
```

### CSS custom properties

Every visual token is a CSS custom property prefixed with `--praescio-`. Override them on `.praescio__panel` or any ancestor element:

```css
.praescio__panel {
  --praescio-item-active-bg: #e0f2fe;
  --praescio-item-active-border: #0ea5e9;
}
```

Full token reference:

| Variable | Default | Description |
|----------|---------|-------------|
| `--praescio-bg` | `#ffffff` | Panel background |
| `--praescio-text-color` | `#111827` | Panel text colour |
| `--praescio-border-color` | `#d1d5db` | Panel border |
| `--praescio-item-hover-bg` | `#f3f4f6` | Item hover background |
| `--praescio-item-active-bg` | `#eff6ff` | Highlighted item background |
| `--praescio-item-active-border` | `#3b82f6` | Highlighted item border |
| `--praescio-highlight-color` | `#1d4ed8` | `<mark>` text colour |
| `--praescio-highlight-weight` | `600` | `<mark>` font weight |
| `--praescio-description-color` | `#6b7280` | Description text colour |
| `--praescio-group-label-color` | `#6b7280` | Group header label colour |
| `--praescio-panel-radius` | `0.375rem` | Panel border-radius |
| `--praescio-panel-shadow` | (subtle drop shadow) | Panel box-shadow |
| `--praescio-panel-max-height` | `18rem` | Maximum panel height |
| `--praescio-z-index` | `9999` | Panel z-index |
| `--praescio-font-size` | `1rem` | Panel font size (min 1rem — below triggers iOS zoom) |
| `--praescio-transition-duration` | `150ms` | Open/close animation duration |

### Dark mode

Dark styles are applied automatically via `prefers-color-scheme: dark`. Force them explicitly with the `data-praescio-theme` attribute or the `praescio--dark` class on the panel or any ancestor:

```html
<!-- Attribute — set on the panel or any ancestor -->
<div data-praescio-theme="dark">…</div>
<!-- or via CSS class -->
<div class="praescio--dark">…</div>
```

---

## Print Support

Praescio includes `@media print` styles that automatically hide the dropdown panel when a page is printed. The input element will display its current value naturally — no extra configuration needed.

See `demos/print.html` for a full print behavior demo.

---

## Framework Connectors

Praescio ships zero-dependency framework connectors that integrate with the component lifecycle of React, Vue 3, Angular, and Svelte. All connectors are exported from the `praescio/connectors` subpath.

```ts
import 'praescio/css';
import { createReactPraescio, createVuePraescio, PraescioDirectiveBase, praescioAction } from 'praescio/connectors';
```

### React (≥ 17)

The connector uses a factory so no React import is needed at build time. Pass `React` (or `{ useEffect, useRef }`) to `createReactPraescio` once, then use the returned hook in your components.

```tsx
import React, { useRef } from 'react';
import { createReactPraescio } from 'praescio/connectors';
import 'praescio/css';

// Create once per app (e.g. in a shared hooks file)
const usePraescio = createReactPraescio(React);

export function CitySearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  usePraescio(inputRef, {
    source: ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin'],
    onSelect: (item) => console.log('chosen:', item.label),
  });

  return <input ref={inputRef} placeholder="Search cities…" />;
}
```

> **Options stability**: options are read once on mount. For dynamic options, pass a stable reference via `useRef` or reset the component `key` to reinitialise.

### Vue 3

The Vue connector uses a composable factory. Pass `{ ref, onMounted, onBeforeUnmount }` once; the returned composable registers lifecycle hooks automatically.

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { createVuePraescio } from 'praescio/connectors';
import 'praescio/css';

const usePraescio = createVuePraescio({ ref, onMounted, onBeforeUnmount });

const inputRef = ref<HTMLInputElement | null>(null);
const instance = usePraescio(inputRef, {
  source: ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin'],
  onSelect: (item) => console.log('chosen:', item.label),
});
</script>

<template>
  <input ref="inputRef" placeholder="Search cities…" />
</template>
```

### Angular (≥ 15)

Extend `PraescioDirectiveBase` in your Angular project and wire Angular decorators to the protected lifecycle methods.

```ts
// praescio.directive.ts
import { Directive, Input, ElementRef, OnInit, OnChanges, OnDestroy } from '@angular/core';
import { PraescioDirectiveBase } from 'praescio/connectors';
import type { PraescioOptions } from 'praescio';

@Directive({ selector: '[praescio]', standalone: true })
export class PraescioDirective<T = unknown>
  extends PraescioDirectiveBase<T>
  implements OnInit, OnChanges, OnDestroy
{
  @Input('praescio') override options!: PraescioOptions<T>;

  constructor(private host: ElementRef<HTMLInputElement>) {
    super();
  }

  ngOnInit(): void    { this.init(this.host.nativeElement); }
  ngOnChanges(): void { this.reinit(this.host.nativeElement); }
  ngOnDestroy(): void { this.teardown(); }
}
```

```html
<!-- Template -->
<input [praescio]="{ source: countries, onSelect: onSelect }" placeholder="Search…" />
```

### Svelte (≥ 4)

The Svelte connector is a pure action — no Svelte imports are needed at build time.

```svelte
<script lang="ts">
  import { praescioAction } from 'praescio/connectors';
  import 'praescio/css';

  const countries = ['Austria', 'Belgium', 'Croatia', 'Denmark'];
  let selected = '';

  $: options = {
    source: countries,
    onSelect: (item) => { selected = item.label; },
  };
</script>

<input use:praescioAction={options} placeholder="Search countries…" />
{#if selected}<p>Selected: {selected}</p>{/if}
```

When the bound `options` object changes, Svelte calls the action's `update` method, which recreates the Praescio instance with the new options.

---

## CDN Usage

```html
<script src="https://unpkg.com/praescio/dist/scripts/praescio.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/praescio/dist/styles/praescio.css" />

<script>
  const { Praescio, fuzzyMatch, keyboardShortcut } = window.Praescio;

  new Praescio('#search', {
    source: ['Apple', 'Banana', 'Cherry'],
    plugins: [keyboardShortcut({ key: 'k' })],
  });
</script>
```

---

## Security

Praescio applies the following protections automatically — no configuration needed.

### `href` sanitization

All `href` values on `link` and `rich` items are sanitized at render time via `sanitizeHref()`. The check is applied after:

1. Stripping leading/trailing whitespace and ASCII control characters (U+0000–U+001F).
2. Collapsing internal whitespace and hyphens (blocks split-protocol tricks such as `javas cript:` or `java-script:`).

Any URL whose protocol resolves to `javascript:`, `vbscript:`, or `data:` is replaced with `'#'`.

### SVG icon sanitization

Inline SVG strings passed to the `icon` field (on `icon`, `rich`, or `group` items) are sanitized before insertion:

- `<script>` elements are removed.
- `<use>` elements with external resource references (any `href` / `xlink:href` that isn't a fragment-only `#id` reference) are removed, preventing remote SVG loading.
- All `on*` event-handler attributes (`onload`, `onerror`, `onclick`, …) are stripped from every element.
- `href` / `xlink:href` values with an unsafe protocol are removed.

Only `data:image/` URIs are accepted as icon image sources; other `data:` schemes (e.g. `data:text/html`) are rejected and treated as CSS class strings.

This prevents XSS attacks through malicious SVG payloads and external resource injection.

### Query trimming

The input value is trimmed before the `minChars` check and before every fetch, so whitespace-only input never opens the suggestion panel or triggers a data request.

### Custom `html` items

The `html` shorthand on `custom` items is written as `innerHTML` — Praescio does **not** sanitize it. Never interpolate unescaped user input into `html`; use the `render` callback instead when the content depends on runtime data.

---

## Demos

Open the demo pages directly in a browser (no build step required):

- `demos/index.html` — main interactive demos covering all item types, plugins, and options
- `demos/print.html` — print behavior demo
- `demos/lighthouse.html` — Lighthouse-optimized demo

---

## Development

```bash
npm run build          # Build JS outputs (rollup)
npm run build:css      # Build CSS outputs (postcss)
npm run build:all      # Build everything
npm run dev            # Watch mode
npm run test           # Run tests (Vitest)
npm run test:coverage  # Run tests with coverage report
npm run test:watch     # Watch mode for tests
npm run typecheck      # TypeScript type check (no emit)
npm run format         # Format with Prettier
npm run lint           # ESLint TypeScript
npm run lint:css       # Stylelint CSS
npm run lint:all       # Run all linters
```

---

## License

MIT © Aditya B
