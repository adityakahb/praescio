# Praescio — Technical Specifications

> A modern, framework-agnostic TypeScript autocomplete/typeahead plugin.  
> "Praescio" (Latin) — *to know in advance.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Competitive Analysis & Lessons Learned](#2-competitive-analysis--lessons-learned)
3. [Real-World Problems & Proposed Solutions](#3-real-world-problems--proposed-solutions)
4. [Architecture Overview](#4-architecture-overview)
5. [Module Structure](#5-module-structure)
6. [Core Subsystems](#6-core-subsystems)
7. [Rendering & Item Types](#7-rendering--item-types)
8. [Accessibility Design](#8-accessibility-design)
9. [Styling System (CSS)](#9-styling-system-css)
10. [Build Outputs](#10-build-outputs)
11. [TypeScript API Design](#11-typescript-api-design)
12. [Configuration Reference](#12-configuration-reference)
13. [Plugin System](#13-plugin-system)
14. [Testing Strategy](#14-testing-strategy)
15. [Security Model](#15-security-model)
16. [Print Support](#16-print-support)
17. [Performance & Lighthouse](#17-performance--lighthouse)
18. [Mobile-First Design](#18-mobile-first-design)
19. [Tooling](#19-tooling)
20. [Non-Goals](#20-non-goals)

---

## 1. Executive Summary

Praescio is a zero-dependency, TypeScript-first autocomplete/typeahead plugin that ships as ESM, CJS, UMD, and CDN-ready builds with bundled `.d.ts` type declarations. It is designed for three primary audiences:

| Audience | Typical Use Case |
|---|---|
| **Web app developers** | Search bars, command palettes, address lookups |
| **CMS / content platforms** | @mentions inside rich text editors (contentEditable) |
| **Design systems** | Drop-in component with full CSS custom property theming |

**Core philosophy:**

- **Headless-first, themed-second.** The core carries zero DOM opinions. A reference theme (plain CSS) ships alongside but is never required.
- **Accessibility is not a feature — it is the floor.** All interaction patterns conform to WAI-ARIA 1.2 `combobox` and `listbox` roles with real focus management (not just `aria-activedescendant`).
- **Async is the default.** Race conditions, stale results, and debouncing are solved at the architecture level, not left to the consumer.
- **Rich items are first-class.** Groups, icons, descriptions, links, and custom templates are part of the data model, not hacks on top of plain-text suggestions.

---

## 2. Competitive Analysis & Lessons Learned

### 2.1 Summary Scorecard

| Library | TypeScript | Framework | Bundle | Accessibility | Rich Items | Grouping | Active |
|---|---|---|---|---|---|---|---|
| Twitter Typeahead.js | No | Vanilla | ~55 KB | Poor | No | No | Dead |
| Algolia Autocomplete | Yes | Multi | ~25 KB | Excellent | Yes | Yes | Yes |
| Downshift | Yes | React only | ~12 KB | Excellent | Via render | Via render | Yes |
| GOV.UK Accessible AC | No | Vanilla | ~18 KB | Excellent | No | No | Slow |
| autoComplete.js | No | Vanilla | ~10 KB | Good | No | No | Yes |
| Tribute.js | No | Vanilla | ~18 KB | Fair | Via template | No | Slow |
| Tom Select | Yes | Multi | ~16 KB | Good | Via template | Partial | Yes |
| Select2 | No | jQuery | ~30 KB | Fair | Via callback | Yes | Yes |
| Choices.js | Limited | Vanilla | ~20 KB | Good | Via template | No | Yes |

### 2.2 Critical Gaps Praescio Must Fill

1. **No zero-dependency TypeScript library covers rich item types as a data primitive.** Every library treats rich rendering as a consumer concern (a callback to override). Praescio models rich items in the type system itself.
2. **Accessibility via `aria-activedescendant` is broken on mobile assistive technology.** GOV.UK proved real `focus()` management is more robust — Praescio adopts this approach.
3. **Race conditions are a known, unsolved problem** in nearly every library. Praescio solves them at the data layer with request sequencing.
4. **CSS/theming is universally painful.** Praescio ships a BEM CSS architecture with CSS custom properties, making theme overrides surgical and predictable — no preprocessor required to customise.
5. **No library ships all output formats** (ESM, ESM minified, CJS, CJS minified, UMD, UMD minified, CDN/IIFE, `.d.ts`) as first-class artifacts.

---

## 3. Real-World Problems & Proposed Solutions

### P1 — Race Conditions in Async Data Fetching

**Problem:** Typing "paris" fires 5 requests. The "par" response may arrive after "paris", displaying stale results.

**Solution: Request Sequencing via Monotonic ID**

Each fetch is tagged with an auto-incrementing `requestId`. The `DataController` only applies results whose `requestId` matches the most-recently-issued ID. Older in-flight requests are cancelled via `AbortController`.

```
keystroke → new requestId → AbortController.abort(previous) → fetch(new) → apply only if id === latest
```

Additionally, a `StaleWhileRevalidate` cache returns a cached result immediately (for perceived speed), while the network request runs in the background — the list updates silently when the fresh response arrives.

---

### P2 — Performance with Large Datasets (10 000+ items)

**Problem:** Rendering 10 000 `<li>` elements causes scroll jank and layout thrashing.

**Solution: Virtual List Rendering**

The `ListRenderer` implements a virtual scrolling window:
- Only the visible items plus a small overscan buffer (e.g., ±5) are in the DOM.
- Items are absolutely positioned; the scroll container has a calculated height.
- Intersection observers trigger updates, not scroll event listeners.
- For the common case (< 100 results), virtual rendering is bypassed entirely.

---

### P3 — Mobile Touch & Zoom Issues

**Problem:** `font-size < 16px` on `<input>` causes iOS Safari to zoom the viewport. Touch events fire `mouseover` ghost events, corrupting hover state.

**Solution:**

- Default CSS sets `font-size: max(1rem, 16px)` on the input to guarantee iOS zoom prevention.
- Touch detection uses `pointer: coarse` media query to apply a separate hover model (visual highlight is driven by `aria-selected`, not CSS `:hover`).
- Minimum tap target for suggestions is 44 × 44 px (WCAG 2.5.5).

See also [Section 18 — Mobile-First Design](#18-mobile-first-design).

---

### P4 — Broken `aria-activedescendant` on Mobile Screen Readers

**Problem:** iOS VoiceOver and Android TalkBack largely ignore `aria-activedescendant`, reading nothing as the user navigates the list.

**Solution: Real Focus Management**

Praescio moves actual DOM `focus()` into suggestion items, not `aria-activedescendant`. Each suggestion `<li>` receives `tabindex="-1"`. Arrow-key navigation calls `.focus()` on the target element. The input retains its `role="combobox"` and `aria-owns` the listbox. This is the same approach proven by GOV.UK's accessible-autocomplete and confirmed to work across NVDA, JAWS, VoiceOver (macOS + iOS), and TalkBack.

The tradeoff (input loses native cursor while list is active) is handled by maintaining an internal `inputValue` buffer so typing mid-navigation resumes correctly.

---

### P5 — Cursor Position Calculation in ContentEditable

**Problem (relevant for @mention mode):** Menu appears at wrong position in scrollable containers, nested editables, or when window is scrolled.

**Solution:**

- Compute position using `Range.getBoundingClientRect()` instead of character offset heuristics.
- Add `window.scrollX` / `window.scrollY` offsets.
- Clamp the resulting rectangle to `window.innerWidth` / `window.innerHeight` so the panel never escapes the viewport.
- A `ResizeObserver` and `scroll` listener on all scrollable ancestors reposition the panel on every layout change.

---

### P6 — CSS Specificity Wars & Theme Overrides

**Problem:** Consumer CSS conflicts with library CSS; `!important` creep begins immediately.

**Solution: BEM + CSS Custom Properties Layer**

All styles use BEM class names scoped under `.praescio` (e.g., `.praescio__panel`, `.praescio__item--highlighted`). Every visual attribute that a theme designer might want to change is exposed as a CSS custom property (e.g., `--praescio-highlight-bg`). Consumers can theme entirely via custom properties without any build step. No styles are ever applied via JavaScript (no inline style injection).

---

### P7 — Grouping and Rich Item Types as Afterthoughts

**Problem:** Most libraries only support plain text items; grouping and rich rendering require consumer-side hacks.

**Solution: Typed Item Model**

The item type is a discriminated union modeled at the data layer:

```
SuggestionItem =
  | TextItem          // plain label
  | DescriptionItem   // label + short paragraph
  | LinkItem          // label + href
  | IconItem          // SVG/img icon + label
  | RichItem          // icon + label + description + optional href
  | CustomItem        // consumer-provided render function
```

Group headers are first-class items in the list:

```
GroupHeader = { type: 'group', label: string; icon?: string }
```

The renderer knows how to render each type. No consumer callback needed for common cases.

---

### P8 — No Unified Caching Strategy

**Problem:** Caching is either absent (race conditions) or always-on (stale data in real-time scenarios).

**Solution: Configurable Cache Strategies**

The `CacheController` supports three strategies selected per-instance via config:

| Strategy | Behaviour | Best For |
|---|---|---|
| `none` | No caching, every keystroke fetches fresh | Real-time data (stocks, live inventory) |
| `query` | Hash map keyed by query string; TTL configurable | Search bars, address lookup |
| `stale-while-revalidate` | Return cache immediately, fetch in background, update if changed | Navigation menus, tag selectors |

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Praescio Instance                       │
│                                                               │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│  │   InputCtrl │───▶│  StateManager   │───▶│  ListRenderer│  │
│  │  (events,   │    │  (FSM-based,    │    │  (virtual    │  │
│  │   debounce) │    │   immutable)    │    │   scroll)    │  │
│  └─────────────┘    └────────┬────────┘    └──────────────┘  │
│                              │                               │
│                   ┌──────────▼──────────┐                    │
│                   │   DataController    │                    │
│                   │  (fetch, abort,     │                    │
│                   │   cache, sequence)  │                    │
│                   └─────────────────────┘                    │
│                                                               │
│  ┌─────────────┐    ┌─────────────────┐                      │
│  │  A11yCtrl   │    │  PluginRegistry  │                      │
│  │  (ARIA,     │    │  (lifecycle      │                      │
│  │   focus)    │    │   hooks)         │                      │
│  └─────────────┘    └─────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow (Single Keystroke)

```
User types "p"
  └─▶ InputController → debounce(300ms)
        └─▶ StateManager.dispatch(QUERY_CHANGED, "p")
              └─▶ DataController.fetch("p", requestId=42)
                    ├─▶ CacheController.get("p") → cache miss
                    ├─▶ AbortController.abort(requestId=41)
                    ├─▶ fetch(source, "p", signal)
                    │     └─▶ response arrives
                    │           └─▶ if requestId === latest (42)
                    │                 └─▶ CacheController.set("p", results)
                    │                       └─▶ StateManager.dispatch(RESULTS_READY, results)
                    │                             └─▶ ListRenderer.update(results)
                    │                                   └─▶ A11yCtrl.announce(count)
                    └─▶ (older requests arrive, silently discarded)
```

---

## 5. Module Structure

```
praescio/
├── src/
│   ├── core/
│   │   ├── state/
│   │   │   ├── StateMachine.ts        # FSM: closed → opening → open → closing
│   │   │   ├── StateManager.ts        # Immutable state + dispatch
│   │   │   └── actions.ts             # Action type constants
│   │   ├── data/
│   │   │   ├── DataController.ts      # Orchestrates fetch, cache, sequence
│   │   │   ├── CacheController.ts     # query / swr / none strategies
│   │   │   ├── RequestQueue.ts        # Monotonic ID + AbortController
│   │   │   └── normalise.ts           # Coerce raw data to SuggestionItem[]
│   │   ├── input/
│   │   │   ├── InputController.ts     # Event binding, debounce, IME handling
│   │   │   └── ContentEditableCtrl.ts # @mention mode, cursor position
│   │   ├── render/
│   │   │   ├── ListRenderer.ts        # Virtual scroll, DOM diffing
│   │   │   ├── ItemRenderer.ts        # Discriminated union → HTML
│   │   │   ├── PanelManager.ts        # Panel open/close, positioning
│   │   │   └── templates/
│   │   │       ├── TextItem.ts
│   │   │       ├── DescriptionItem.ts
│   │   │       ├── LinkItem.ts
│   │   │       ├── IconItem.ts
│   │   │       ├── RichItem.ts
│   │   │       └── GroupHeader.ts
│   │   ├── a11y/
│   │   │   ├── A11yController.ts      # Focus management, ARIA attributes
│   │   │   ├── LiveRegion.ts          # aria-live announcements
│   │   │   └── KeyboardHandler.ts     # All keyboard event logic
│   │   └── plugins/
│   │       └── PluginRegistry.ts      # Lifecycle hook system
│   ├── types/
│   │   ├── SuggestionItem.ts          # Discriminated union item types
│   │   ├── PraescioOptions.ts         # Full config interface
│   │   ├── DataSource.ts              # Source function type
│   │   ├── Events.ts                  # Event names + payload types
│   │   └── Plugin.ts                  # Plugin interface
│   ├── utils/
│   │   ├── debounce.ts
│   │   ├── throttle.ts
│   │   ├── dom.ts                     # Safe query helpers + sanitizeHref()
│   │   ├── position.ts                # Panel positioning + viewport clamping
│   │   └── highlight.ts               # Query highlight in item labels
│   ├── styles/
│   │   ├── base.css                   # Core BEM structure (.praescio__panel, __list, __live)
│   │   ├── item.css
│   │   ├── group.css
│   │   ├── icons.css
│   │   ├── states.css                 # highlighted, selected, loading, empty
│   │   ├── responsive.css             # Mobile-first breakpoints
│   │   ├── print.css                  # @media print — hides panel in print context
│   │   ├── themes/
│   │   │   ├── default.css            # --praescio-* custom property declarations (light theme)
│   │   │   └── dark.css               # Dark palette overrides
│   │   └── praescio.css               # Entry point (@import all partials)
│   └── index.ts                       # Public API entry point
├── dist/                              # Generated — not committed
│   ├── scripts/
│   │   ├── praescio.esm.js            # ESM, tree-shakeable
│   │   ├── praescio.esm.min.js        # ESM minified
│   │   ├── praescio.cjs.js            # CommonJS
│   │   ├── praescio.cjs.min.js        # CommonJS minified
│   │   ├── praescio.umd.js            # UMD (AMD / CommonJS / browser global)
│   │   ├── praescio.umd.min.js        # UMD minified
│   │   └── praescio.min.js            # CDN/IIFE, self-contained, minified
│   ├── styles/
│   │   ├── praescio.css               # Full stylesheet
│   │   └── praescio.min.css           # Minified stylesheet
│   └── praescio.d.ts                  # Bundled TypeScript declarations
├── demos/
│   ├── index.html                     # Kitchen-sink demo
│   ├── print.html                     # Print support demo
│   └── lighthouse.html                # Lighthouse / performance demo
├── docs/
│   └── praescio-specs.md              # This file
├── tests/
│   ├── unit/
│   ├── integration/
│   └── a11y/
├── rollup.config.ts
├── postcss.config.js
├── .eslintrc.js                       # Flat config (ESLint v9+)
├── .stylelintrc.js
├── .prettierrc
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

---

## 6. Core Subsystems

### 6.1 State Machine

The plugin lifecycle is modeled as a Finite State Machine (FSM) to prevent impossible states:

```
IDLE ──[input focus + min chars]──▶ LOADING
LOADING ──[results ready]──────────▶ OPEN
LOADING ──[no results]─────────────▶ EMPTY
OPEN ──[Escape / blur]─────────────▶ IDLE
OPEN ──[item selected]─────────────▶ IDLE
EMPTY ──[new query]────────────────▶ LOADING
IDLE ──[↓ arrow pressed]───────────▶ OPEN (if cached results exist)
```

All state transitions are pure functions — the state manager holds the only mutable reference and emits diffs to subscribers. This makes the plugin trivially testable and inspectable.

### 6.2 DataController

Responsibilities:
- Accepts a `DataSource` (sync array, async function, or URL string).
- Issues fetches with monotonic `requestId`.
- Cancels previous in-flight requests via `AbortController`.
- Passes results through the `CacheController`.
- Normalises raw results to `SuggestionItem[]` via `normalise.ts`.
- Emits `RESULTS_READY` or `FETCH_ERROR` to `StateManager`.

```typescript
type DataSource<T> =
  | T[]
  | ((query: string, signal: AbortSignal) => Promise<T[]>)
  | string; // URL template: "/api/search?q={query}"
```

### 6.3 InputController

Responsibilities:
- Attaches to `<input>`, `<textarea>`, or `contenteditable` element.
- Debounces `input` events (default 300 ms, configurable).
- **Trims** the input value before `minChars` check and fetch — whitespace-only input is treated as empty.
- Handles IME composition events (`compositionstart` / `compositionend`) — does not fire queries during CJK composition.
- Delegates all key events to `KeyboardHandler`.
- In `contenteditable` mode, delegates to `ContentEditableCtrl` for trigger-character detection and cursor position.

### 6.4 A11yController

Responsibilities:
- Sets correct ARIA attributes on the `<input>` on mount:
  - `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-haspopup="listbox"`.
- Manages real `focus()` navigation between input and list items.
- Maintains a `LiveRegion` (`role="status"`, `aria-live="polite"`) that announces:
  - Number of results when list opens.
  - Currently highlighted item (label + position).
  - "No results found" when list is empty.
- Ensures the panel has `role="listbox"` and each item has `role="option"` with `aria-selected`.
- Ensures group headers have `role="group"` with `aria-label`.

### 6.5 KeyboardHandler

Full keyboard support matrix:

| Key | Behaviour |
|---|---|
| `↓` | Move focus to first/next item |
| `↑` | Move focus to previous item; wrap to input from first item |
| `Enter` | Select highlighted item |
| `Tab` | Select highlighted item and advance focus (if `selectOnTab: true`) |
| `Escape` | Close panel, return focus to input, clear highlight |
| `Home` | Move focus to first item in list |
| `End` | Move focus to last item in list |
| `PageDown` | Advance highlight by `pageSize` items (default 5) |
| `PageUp` | Retreat highlight by `pageSize` items |
| Any printable character (while item is focused) | Transfer character to input, return focus to input, re-query |

---

## 7. Rendering & Item Types

### 7.1 SuggestionItem Discriminated Union

```typescript
type SuggestionItem =
  | TextItem
  | DescriptionItem
  | LinkItem
  | IconItem
  | RichItem
  | GroupHeader
  | DividerItem
  | CustomItem;

interface TextItem {
  type: 'text';
  label: string;
  value?: string;
  meta?: Record<string, unknown>;
}

interface DescriptionItem {
  type: 'description';
  label: string;
  description: string;
  value?: string;
  meta?: Record<string, unknown>;
}

interface LinkItem {
  type: 'link';
  label: string;
  href: string;
  target?: '_self' | '_blank';
  description?: string;
  meta?: Record<string, unknown>;
}

interface IconItem {
  type: 'icon';
  label: string;
  icon: string;        // SVG string, URL, or icon-font class
  iconAlt?: string;    // alt text for img icons (omit for decorative)
  value?: string;
  meta?: Record<string, unknown>;
}

interface RichItem {
  type: 'rich';
  label: string;
  description?: string;
  href?: string;
  target?: '_self' | '_blank';
  icon?: string;
  iconAlt?: string;
  badge?: string;
  value?: string;
  meta?: Record<string, unknown>;
}

interface GroupHeader {
  type: 'group';
  label: string;
  icon?: string;
  collapsible?: boolean;
}

interface DividerItem {
  type: 'divider';
}

interface CustomItem {
  type: 'custom';
  render?: (container: HTMLElement, query: string) => void | (() => void); // optional; takes precedence over html
  html?: string;  // raw innerHTML shorthand — caller is responsible for sanitization
  value?: string;
  label: string; // used for screen reader announcements even with custom render
}
```

### 7.2 Rendered HTML Structure

```html
<!-- Panel -->
<div class="praescio__panel" role="listbox" aria-label="Suggestions" id="praescio-list-{uid}">

  <!-- Group header -->
  <div class="praescio__group" role="group" aria-label="Recent">
    <span class="praescio__group__label">
      <img class="praescio__group__icon" src="..." alt="" aria-hidden="true" />
      Recent
    </span>

    <!-- RichItem -->
    <div class="praescio__item praescio__item--rich" role="option" tabindex="-1" aria-selected="false" id="praescio-item-{uid}-0">
      <span class="praescio__item__icon" aria-hidden="true"><!-- SVG --></span>
      <span class="praescio__item__body">
        <span class="praescio__item__label">Result <mark class="praescio__highlight">que</mark>ry</span>
        <span class="praescio__item__description">Short paragraph goes here.</span>
      </span>
      <span class="praescio__item__badge">New</span>
    </div>

    <!-- LinkItem -->
    <a class="praescio__item praescio__item--link" role="option" tabindex="-1"
       href="/docs/foo" target="_self" aria-selected="false" id="praescio-item-{uid}-1">
      <span class="praescio__item__label">Documentation link</span>
    </a>

  </div>

  <hr class="praescio__divider" role="separator" aria-hidden="true" />

  <!-- TextItem (plain) -->
  <div class="praescio__item praescio__item--text" role="option" tabindex="-1" aria-selected="false" id="praescio-item-{uid}-2">
    <span class="praescio__item__label">Plain text result</span>
  </div>

</div>

<!-- Live region (off-screen, always in DOM) -->
<div class="praescio__live" role="status" aria-live="polite" aria-atomic="true"></div>
```

### 7.3 Query Highlight

Matched characters in `label` are wrapped in `<mark class="praescio__highlight">` — styled purely with CSS, no inline styles. Highlighting is performed in `utils/highlight.ts` using a safe DOM-building strategy (never `innerHTML += string`) to prevent XSS.

---

## 8. Accessibility Design

### 8.1 ARIA Pattern: `combobox` (WAI-ARIA 1.2)

Praescio implements the WAI-ARIA 1.2 `combobox` pattern (not 1.1 — the 1.1 pattern is deprecated and had structural issues).

```
<input role="combobox"
       aria-autocomplete="list"
       aria-haspopup="listbox"
       aria-expanded="false|true"
       aria-controls="praescio-list-{uid}"
       autocomplete="off"
       spellcheck="false" />
```

### 8.2 Focus Management Strategy

**Why not `aria-activedescendant`:**
- iOS VoiceOver and Android TalkBack do not reliably consume `aria-activedescendant`.
- Screen reader cursor moves independently via swipe; keyboard focus on the input does not move the screen reader cursor to the list.
- GOV.UK's testing across 13 assistive technology combinations showed real `focus()` is more compatible.

**Real focus flow:**
1. User opens list → input retains focus.
2. User presses `↓` → `listitem[0].focus()` is called; `aria-selected="true"` is set.
3. `LiveRegion` announces: *"1 of 8: Paris — capital of France"*.
4. User presses `Enter` → `onSelect` fires, focus returns to input.
5. User presses `Escape` → panel closes, focus returns to input.
6. Clicking an item → `mousedown.preventDefault()` keeps input focused until `click` fires, then `onSelect` runs.

### 8.3 Screen Reader Announcements

| Event | Live Region Text |
|---|---|
| Results loaded | *"8 results available."* |
| No results | *"No results for 'xyz'."* |
| Item focused | *"{position} of {total}: {label}"* |
| Item focused (with description) | *"{position} of {total}: {label}. {description}"* |
| Panel closed | *(silent — no announcement; avoids noise)* |

### 8.4 High Contrast & Forced Colors

All states use `outline` and `border` properties (not `box-shadow` only) so that Windows High Contrast Mode and `forced-colors: active` media queries work without additional overrides.

### 8.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .praescio__panel {
    transition: none;
    animation: none;
  }
}
```

---

## 9. Styling System (CSS)

### 9.1 Approach: BEM + CSS Custom Properties

All class names follow BEM under the `.praescio` namespace. Every visual token is expressed as a CSS custom property (`--praescio-*`). There is no preprocessor dependency — the stylesheet is plain CSS with native features. Consumers theme purely by overriding `--praescio-*` variables on any ancestor element; no build step is required.

Native CSS nesting (Level 3, baseline 2024) is used within component files for readability. PostCSS processes the source for browser compatibility during the build (see [Section 19 — Tooling](#19-tooling)).

### 9.2 CSS Custom Properties (`--praescio-*`)

All tokens are declared on `.praescio__panel` in `themes/default.css`. Override any token on a parent element to theme scoped instances.

```css
/* themes/default.css */
.praescio__panel {
  /* Colours */
  --praescio-bg:                  #ffffff;
  --praescio-border-color:        #d1d5db;
  --praescio-item-hover-bg:       #f3f4f6;
  --praescio-item-active-bg:      #eff6ff;
  --praescio-highlight-color:     #1d4ed8;
  --praescio-group-label-color:   #6b7280;
  --praescio-description-color:   #6b7280;

  /* Typography */
  --praescio-font-family:         inherit;
  --praescio-font-size:           1rem;       /* Never below 1rem — prevents iOS zoom */
  --praescio-label-weight:        400;
  --praescio-description-size:    0.875rem;

  /* Spacing */
  --praescio-panel-padding:       0.25rem;
  --praescio-item-padding-y:      0.5rem;
  --praescio-item-padding-x:      0.75rem;
  --praescio-group-padding-top:   0.75rem;
  --praescio-item-min-height:     2.75rem;    /* 44px — WCAG 2.5.5 tap target */

  /* Layout */
  --praescio-panel-max-height:    18rem;
  --praescio-panel-min-width:     100%;
  --praescio-panel-radius:        0.375rem;
  --praescio-panel-shadow:        0 4px 6px -1px rgb(0 0 0 / 0.1);
  --praescio-z-index:             9999;

  /* Animation */
  --praescio-transition-duration: 150ms;
  --praescio-transition-easing:   ease-out;

  /* Breakpoint token (informational; also hard-coded in media queries) */
  --praescio-breakpoint:          1280px;
}
```

Consumer theming — override on any ancestor element, no build step needed:

```css
.my-search-bar {
  --praescio-bg: #1e293b;
  --praescio-item-active-bg: #334155;
  --praescio-highlight-color: #38bdf8;
}
```

### 9.3 File Organisation (`@import`-based)

`src/styles/praescio.css` is the single entry point. It imports partials in dependency order using CSS `@import` statements. PostCSS (`postcss-import`) inlines all imports at build time, producing a single output file.

```css
/* praescio.css — entry point */
@import './themes/default.css';   /* --praescio-* custom property declarations */
@import './base.css';             /* panel shell, list, live region */
@import './item.css';             /* item BEM variants */
@import './group.css';            /* group headers */
@import './icons.css';            /* icon sizing */
@import './states.css';           /* highlighted, selected, loading, empty */
@import './responsive.css';       /* mobile-first breakpoints */
@import './themes/dark.css';      /* dark theme overrides */
@import './print.css';            /* @media print */
```

### 9.4 Dark Theme

The `data-praescio-theme="dark"` attribute (user-applied, on the panel or any ancestor) or the `.praescio--dark` CSS class activates the dark palette:

```css
/* themes/dark.css — explicit dark (attribute or class on panel or any ancestor) */
:is([data-praescio-theme="dark"], .praescio--dark) .praescio__panel,
.praescio__panel:is([data-praescio-theme="dark"], .praescio--dark) {
  --praescio-bg: #1e293b;
  --praescio-border-color: #475569;
  --praescio-item-hover-bg: #334155;
  --praescio-item-active-bg: #1e3a5f;
  --praescio-highlight-color: #93c5fd;
  --praescio-group-label-color: #94a3b8;
  --praescio-description-color: #94a3b8;
}

/* Auto dark via OS preference */
@media (prefers-color-scheme: dark) {
  .praescio__panel:not([data-praescio-theme="light"]) {
    --praescio-bg: #1e293b;
    --praescio-border-color: #475569;
    --praescio-item-hover-bg: #334155;
    /* ... all dark tokens ... */
  }
}
```

**Naming distinction:** `data-praescio-theme` is user-applied (theme control), while `data-praescio-placement` is library-applied (positioning). They deliberately use different prefixes so each party controls its own namespace.

### 9.5 Native CSS Nesting

Component CSS files use Level 3 native nesting (baseline 2024). All modern browsers handle this natively — no `postcss-nesting` plugin is used. The build pipeline is limited to `postcss-import` (inline `@import`) and `autoprefixer` (vendor prefixes).

All component styles are nested inside `.praescio__panel {}` so every selector is automatically scoped to the component root without any shadow DOM or CSS Modules tooling:

```css
/* item.css — nesting inside the panel scope */
.praescio__panel {
  & .praescio__item {
    display: flex;
    align-items: center;
    min-height: var(--praescio-item-min-height);

    & .praescio__item__label {
      flex: 1;
      font-size: var(--praescio-font-size);
    }

    &.praescio__item--highlighted {
      background: var(--praescio-item-active-bg);
    }
  }
}
```

---

## 10. Build Outputs

### 10.1 Target Formats

| Format | File | Use Case |
|---|---|---|
| **ESM** | `dist/scripts/praescio.esm.js` | Bundlers (Vite, Rollup, Webpack) — tree-shakeable |
| **ESM minified** | `dist/scripts/praescio.esm.min.js` | ESM CDN delivery |
| **CJS** | `dist/scripts/praescio.cjs.js` | Node.js / older toolchains |
| **CJS minified** | `dist/scripts/praescio.cjs.min.js` | CJS production bundles |
| **UMD** | `dist/scripts/praescio.umd.js` | AMD loaders, CommonJS, browser global |
| **UMD minified** | `dist/scripts/praescio.umd.min.js` | UMD production / legacy CDN |
| **CDN/IIFE** | `dist/scripts/praescio.min.js` | `<script>` tag; exposes `window.Praescio` |
| **CSS** | `dist/styles/praescio.css` | Full stylesheet (expanded) |
| **CSS minified** | `dist/styles/praescio.min.css` | Production stylesheet |
| **Types** | `dist/praescio.d.ts` | Bundled TypeScript declarations |

**Sourcemaps:** External `.map` files accompany unminified JS outputs (ESM, CJS, UMD) with `inlineSources: true` so the original TypeScript is embedded. Minified bundles ship without sourcemaps.

### 10.2 Build Tool: Rollup

Rollup is chosen over esbuild or tsc alone because:
- Produces clean ES module output with optimal tree-shaking.
- UMD/CDN output is straightforward to configure.
- Plugin ecosystem (`@rollup/plugin-typescript`, `@rollup/plugin-terser`) is mature.
- `rollup-plugin-dts` bundles all `.d.ts` files into a single `praescio.d.ts`.

```typescript
// rollup.config.ts (outline)

// Intercepts '../core/Praescio' before TypeScript resolves it to an absolute
// path, returning the bare specifier 'praescio'. This keeps the core external
// in the connectors bundle so consumers deduplicate it automatically.
const externalCorePlugin = () => ({
  name: 'praescio-external-core',
  resolveId(id) {
    if (id === '../core/Praescio') return { id: 'praescio', external: true };
    return null;
  },
});

export default [
  // Core — ESM (tree-shakeable, with sourcemap)
  {
    input: 'src/index.ts',
    treeshake: { moduleSideEffects: false },
    output: { file: 'dist/scripts/praescio.esm.js', format: 'esm', sourcemap: true },
    plugins: [typescript({ declarationDir: 'dist/scripts', declaration: true })],
  },
  // Core — ESM minified
  { input: 'src/index.ts', output: { file: 'dist/scripts/praescio.esm.min.js', format: 'esm' }, plugins: [typescript(), terser()] },
  // Core — CJS (with sourcemap)
  { input: 'src/index.ts', output: { file: 'dist/scripts/praescio.cjs.js', format: 'cjs', exports: 'named', sourcemap: true }, plugins: [typescript()] },
  // Core — CJS minified
  { input: 'src/index.ts', output: { file: 'dist/scripts/praescio.cjs.min.js', format: 'cjs', exports: 'named' }, plugins: [typescript(), terser()] },
  // Core — UMD (with sourcemap)
  { input: 'src/index.ts', output: { file: 'dist/scripts/praescio.umd.js', format: 'umd', name: 'Praescio', sourcemap: true }, plugins: [typescript()] },
  // Core — UMD minified
  { input: 'src/index.ts', output: { file: 'dist/scripts/praescio.umd.min.js', format: 'umd', name: 'Praescio' }, plugins: [typescript(), terser()] },
  // Core — CDN/IIFE minified
  { input: 'src/index.ts', output: { file: 'dist/scripts/praescio.min.js', format: 'iife', name: 'Praescio' }, plugins: [typescript(), terser()] },
  // Core — bundled type declarations
  { input: 'dist/scripts/index.d.ts', output: { file: 'dist/praescio.d.ts', format: 'esm' }, plugins: [dts()] },

  // Connectors — ESM (core external, with sourcemap)
  {
    input: 'src/connectors/index.ts',
    treeshake: { moduleSideEffects: false },
    output: { file: 'dist/scripts/praescio-connectors.esm.js', format: 'esm', sourcemap: true },
    plugins: [externalCorePlugin(), typescript({ declarationDir: 'dist/scripts/connectors', declaration: true })],
  },
  // Connectors — ESM minified (core external)
  { input: 'src/connectors/index.ts', output: { file: 'dist/scripts/praescio-connectors.esm.min.js', format: 'esm' }, plugins: [externalCorePlugin(), typescript(), terser()] },
  // Connectors — bundled type declarations
  { input: 'dist/scripts/connectors/index.d.ts', output: { file: 'dist/praescio-connectors.d.ts', format: 'esm' }, plugins: [dts()] },
];
```

### 10.3 TypeScript Config

`tsconfig.build.json` extends base config with:
- `"declaration": true`
- `"declarationMap": false` (declarations are bundled by `rollup-plugin-dts`)
- `"sourceMap": false` (Rollup controls sourcemap output per-build via `output.sourcemap`; this disables TypeScript's own `.js.map` emission to avoid duplicates)
- `"target": "ES2019"` (covers 98%+ of browsers without polyfills)
- `"strict": true`
- `"noUncheckedIndexedAccess": true`

### 10.4 CSS Build

PostCSS processes `src/styles/praescio.css` via `postcss-import` (inlines `@import`) and `autoprefixer` (adds vendor prefixes). Native CSS nesting is not transformed — it is preserved as-is and resolved by the browser. `cssnano` produces the minified variant.

```
src/styles/praescio.css
  └─▶ postcss-import  → inlines @import partials
  └─▶ autoprefixer    → vendor prefixes
  └─▶ dist/styles/praescio.css        (full)
  └─▶ cssnano         → minified
  └─▶ dist/styles/praescio.min.css    (minified)
```

### 10.5 `package.json` Exports Map

```json
{
  "main": "dist/scripts/praescio.cjs.js",
  "module": "dist/scripts/praescio.esm.js",
  "types": "dist/praescio.d.ts",
  "exports": {
    ".": {
      "import": "./dist/scripts/praescio.esm.js",
      "require": "./dist/scripts/praescio.cjs.js",
      "types": "./dist/praescio.d.ts"
    },
    "./css": "./dist/styles/praescio.css",
    "./connectors": {
      "import": "./dist/scripts/praescio-connectors.esm.js",
      "types": "./dist/praescio-connectors.d.ts"
    }
  },
  "sideEffects": ["dist/styles/*.css"]
}
```

---

## 11. TypeScript API Design

### 11.1 Constructor

```typescript
import Praescio from 'praescio';

const ac = new Praescio('#search-input', {
  source: async (query, signal) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    return res.json(); // array of any shape — normalised by 'transform'
  },
  transform: (raw) => ({
    type: 'rich',
    label: raw.name,
    description: raw.tagline,
    icon: raw.logoUrl,
    href: raw.url,
    value: raw.id,
  }),
  groupBy: (item) => item.meta?.category as string,
  cache: 'query',
  cacheTTL: 60_000,
  debounce: 300,
  minChars: 2,
  maxItems: 10,
  selectOnTab: true,
  highlight: true,
  onSelect: (item) => {
    window.location.href = item.href ?? '#';
  },
});
```

### 11.2 Full Options Interface

```typescript
interface PraescioOptions<T = unknown> {
  // Data
  source: DataSource<T>;
  transform?: (raw: T) => SuggestionItem;
  groupBy?: (item: SuggestionItem) => string | undefined;
  sortGroups?: (a: string, b: string) => number;

  // Behaviour
  debounce?: number;           // ms, default 300
  minChars?: number;           // default 1
  maxItems?: number;           // default 10; 0 = unlimited
  cache?: 'none' | 'query' | 'stale-while-revalidate';
  cacheTTL?: number;           // ms, default 300_000 (5 min)
  selectOnTab?: boolean;       // default true
  closeOnSelect?: boolean;     // default true
  openOnFocus?: boolean;       // show cached results on re-focus, default false
  highlight?: boolean;         // highlight matching chars, default true
  showEmpty?: boolean;         // show "No results" slot, default true
  virtualScroll?: boolean;     // auto-enabled when results > 100, default 'auto'

  // ContentEditable / @mention mode
  trigger?: string;            // character that opens the panel, e.g. '@'
  insertTemplate?: (item: SuggestionItem) => string; // what to insert

  // Panel positioning
  placement?: 'bottom' | 'top' | 'auto';  // default 'auto'
  offset?: number;             // px gap between input and panel, default 4

  // Callbacks (lifecycle)
  onOpen?: () => void;
  onClose?: () => void;
  onSelect?: (item: SuggestionItem, originalEvent: Event) => void;
  onQuery?: (query: string) => void;
  onFetchStart?: (query: string) => void;
  onFetchEnd?: (query: string, items: SuggestionItem[]) => void;
  onFetchError?: (query: string, error: Error) => void;
  onHighlight?: (item: SuggestionItem | null, index: number) => void;
  onEmpty?: (query: string) => void;
  onDestroy?: () => void;

  // Slots (HTML strings or render functions)
  slots?: {
    empty?: string | ((query: string) => HTMLElement);
    loading?: string | HTMLElement;
    header?: string | HTMLElement;
    footer?: string | HTMLElement;
  };

  // a11y
  ariaLabel?: string;          // listbox label, default 'Suggestions'
  announceResults?: (count: number, query: string) => string;
  announceItem?: (item: SuggestionItem, index: number, total: number) => string;

  // Plugins
  plugins?: PraescioPlugin[];
}
```

### 11.3 Instance Methods

```typescript
interface PraescioInstance {
  open(query?: string): void;
  close(): void;
  setQuery(value: string, triggerFetch?: boolean): void;
  refresh(): void;         // re-run last query (bypasses cache)
  clearCache(): void;
  destroy(): void;         // removes all DOM, unbinds all events
  on<K extends keyof PraescioEvents>(event: K, handler: PraescioEvents[K]): () => void;
  off<K extends keyof PraescioEvents>(event: K, handler: PraescioEvents[K]): void;
}

// Full event map
interface PraescioEvents {
  open:        () => void;
  close:       () => void;
  select:      (item: SuggestionItem, originalEvent: Event) => void;
  query:       (query: string) => void;
  fetchStart:  (query: string) => void;
  fetchEnd:    (query: string, items: SuggestionItem[]) => void;
  fetchError:  (query: string, error: Error) => void;
  highlight:   (item: SuggestionItem | null, index: number) => void;
  empty:       (query: string) => void;
  destroy:     () => void;
}
```

---

## 12. Configuration Reference

### 12.1 `source` — Supported Shapes

```typescript
// 1. Static array (sync)
source: ['Apple', 'Banana', 'Cherry']

// 2. Array of objects with default transform
source: [{ label: 'Apple', value: 'apple' }]

// 3. Async function (full control)
source: async (query, signal) => {
  const res = await fetch(`/search?q=${query}`, { signal });
  return res.json();
}

// 4. URL template (built-in fetch)
source: 'https://api.example.com/suggest?q={query}'
//  {query} is replaced with encodeURIComponent(query)
//  Expects JSON array response
```

### 12.2 `groupBy` Behaviour

When `groupBy` is provided:
- Results are sorted so items with the same group key are adjacent.
- A `GroupHeader` item is inserted before each group.
- `sortGroups` controls group ordering; default is insertion order.
- `undefined` return means the item belongs to no group (rendered before all groups).

### 12.3 `slots` — Extending the Panel

```typescript
slots: {
  empty: '<p class="my-empty">No cities found. <a href="/add">Add one?</a></p>',
  loading: '<span class="spinner" aria-hidden="true"></span> Searching…',
  header: '<div class="panel-header">Top results</div>',
  footer: (query) => {
    const el = document.createElement('a');
    el.href = `/search?q=${encodeURIComponent(query)}`;
    el.textContent = `See all results for "${query}"`;
    return el;
  },
}
```

---

## 13. Plugin System

Plugins attach lifecycle hooks and can modify item rendering, data, or panel content.

```typescript
interface PraescioPlugin {
  name: string;
  install(instance: PraescioInstance, options: PraescioOptions): void;
}
```

### 13.1 Bundled Plugins

| Plugin | Purpose |
|---|---|
| `recentSearches` | Stores and shows last N queries from `localStorage` |
| `fuzzyMatch` | Replaces exact prefix matching with fuzzy scoring (Levenshtein distance) |
| `keyboardShortcut` | Opens plugin panel via configurable keyboard shortcut (e.g., `⌘K`) |
| `analytics` | Fires configurable callbacks on query + select events for tracking |

### 13.2 Plugin Example — Recent Searches

```typescript
import Praescio, { recentSearches } from 'praescio';

const ac = new Praescio('#search', {
  source: fetchRemote,
  plugins: [
    recentSearches({ maxItems: 5, storageKey: 'praescio_recent' }),
  ],
});
// On focus with empty query, shows last 5 searches above remote results.
```

---

## 14. Testing Strategy

### 14.1 Unit Tests (Vitest + jsdom)

Tests run with Vitest under a jsdom environment. v8 coverage provider. Current coverage: **227 tests across 19 files**.

Modules with 100% statement/branch coverage:

| File | Tests | Key Scenarios |
|---|---|---|
| `StateMachine.ts` | 13 | All FSM transitions, guard conditions, invalid transitions throw |
| `CacheController.ts` | 12 | TTL expiry, SWR background update, `none` passthrough |
| `RequestQueue.ts` | 10 | Concurrent cancellation, monotonic ID sequencing |
| `highlight.ts` | 12 | XSS safety, correct `<mark>` placement, multi-occurrence |
| `normalise.ts` | 11 | All source shapes → `SuggestionItem[]`, fallbacks |
| `EventEmitter.ts` | 10 | on/emit, dedup, unsubscribe, destroy clears all handlers |
| `LiveRegion.ts` | 13 | DOM injection, `praescio__live` class, announce delay/clear, destroy |
| `StateManager.ts` | 8 | Initial state, dispatch + notify, unsubscribe, sequential transitions |
| `uid.ts` | 5 | String output, prefix, uniqueness, monotonic increment |
| `throttle.ts` | 5 | First call fires, window suppression, window expiry, arg passthrough |
| `position.ts` | 7 | Bottom/top placement, viewport clamping, scrollX/scrollY offset |

Modules with partial coverage:

| File | Tests | Key Scenarios |
|---|---|---|
| `PanelManager.ts` | 6 | `buildPanelShell` — class/id, list appended, string/element slots |
| `ListRenderer.ts` | 20 | `praescio__list` construction, render, highlight state, showSlot, destroy |
| `InputController.ts` | 8 | Debounce, trim, minChars, IME guard, openOnFocus |
| `templates/*.ts` | 12 | TextItem, DescriptionItem, LinkItem, IconItem, RichItem, GroupHeader |
| `dom.ts` | 6 | `sanitizeHref`, `el()`, `contains`, `injectStyles` |
| `DataController.ts` | 8 | Fetch orchestration, abort on new query, groupBy, error state |
| `A11yController.ts` | 6 | ARIA attributes, combobox role, aria-expanded |
| `KeyboardHandler.ts` | 10 | Arrow keys, Enter, Escape, Tab, Home/End, Page Up/Down |

### 14.2 Integration Tests (Playwright)

- Full keystroke simulation on a real DOM.
- Race condition simulation: slow first request, fast second request — only second results render.
- IME composition: typing Korean characters does not fire queries mid-composition.
- `destroy()` — no memory leaks, all event listeners removed.

### 14.3 Accessibility Tests

- `axe-core` run on every rendered state (open, loading, empty, item focused).
- Manual test matrix (documented, not automated):
  - NVDA + Chrome (Windows)
  - JAWS + Chrome (Windows)
  - VoiceOver + Safari (macOS)
  - VoiceOver + Safari (iOS)
  - TalkBack + Chrome (Android)

### 14.4 Visual Regression (Storybook + Chromatic)

- Stories for each item type, group layout, dark theme, loading state, empty state.
- Pixel-diff against approved snapshots on each PR.

---

## 15. Security Model

| Vector | Mitigation |
|---|---|
| `javascript:` / `vbscript:` in `href` | `sanitizeHref()` replaces unsafe protocols with `'#'` at render time (LinkItem, RichItem) |
| XSS via inline SVG (`onload`, `onerror`, `<script>`) | `sanitizeSvgElement()` strips `<script>` nodes and `on*` attributes before `importNode` |
| Whitespace-only input bypassing `minChars` | `InputController` trims before the length check; pure-whitespace input is treated as empty |
| `CustomItem.html` raw injection | Not sanitized — documented as caller responsibility; `render` callback preferred for dynamic content |

---

## 16. Print Support

### 16.1 Overview

Praescio includes `src/styles/print.css`, which is imported last in `praescio.css`. It contains a single `@media print` block that hides the suggestion panel and live region from printed output.

### 16.2 Print Styles

```css
/* print.css */
@media print {
  .praescio__panel,
  .praescio__live {
    display: none !important;
  }
}
```

The `!important` declaration is intentional and scoped exclusively to `@media print` — it ensures the panel is hidden regardless of any `display` value set by JavaScript state management (open, loading, etc.). It does not affect screen rendering.

### 16.3 Rationale

Without explicit print styles, an open suggestion panel may appear in print output at a position unrelated to the document flow, and the off-screen live region may produce a blank gap on the printed page.

### 16.4 Testing Print Styles

1. Open `demos/print.html` in a browser.
2. Open the autocomplete panel (type any query to populate results).
3. Trigger browser print preview (`Ctrl+P` / `Cmd+P`).
4. Verify: the suggestion panel and live region are absent from the preview.

### 16.5 Print Demo

`demos/print.html` is a minimal standalone page that loads the library from `dist/scripts/praescio.min.js` and `dist/styles/praescio.css`. It provides a live input, instructions for opening the panel, and a print button that calls `window.print()` directly so the behaviour can be verified without the browser menu.

---

## 17. Performance & Lighthouse

### 17.1 Overview

`demos/lighthouse.html` is a purpose-built demo page that applies every performance technique available for a client-side library. It serves as a living reference for how to integrate Praescio in a Lighthouse-optimised context and is used during development to track performance regressions.

### 17.2 Code Splitting

The demo uses native ES module `import()` (dynamic import) to defer non-critical plugin code until after the first user interaction:

```html
<!-- Static import for the core — downloaded during parse, executed after DOMContentLoaded -->
<script type="module">
  import Praescio from './dist/scripts/praescio.esm.js';

  document.addEventListener('DOMContentLoaded', () => {
    const ac = new Praescio('#search', { source: '/api/suggest?q={query}' });
  });

  // Defer plugin load until user focuses the input
  document.getElementById('search').addEventListener('focus', async () => {
    const { recentSearches } = await import('./dist/scripts/praescio.esm.js');
    ac.use(recentSearches());
  }, { once: true });
</script>
```

### 17.3 Critical CSS Inlining

The minimal CSS required to render the visible input (before the panel opens) is inlined in `<style>` in `<head>`. The full `praescio.min.css` is loaded asynchronously and only applied when the panel first opens:

```html
<head>
  <!-- Critical CSS: input layout only; panel styles not yet needed -->
  <style>
    .search-wrapper { position: relative; }
    #search { width: 100%; font-size: 1rem; }
  </style>

  <!-- Full stylesheet deferred; rel="preload" ensures it is fetched early -->
  <link rel="preload" href="dist/styles/praescio.min.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="dist/styles/praescio.min.css"></noscript>
</head>
```

### 17.4 Deferred Script Loading

The CDN/IIFE build (`praescio.min.js`) is loaded with `defer` when used in non-module contexts:

```html
<script src="dist/scripts/praescio.min.js" defer></script>
```

The ESM build should be loaded with `type="module"` (which is implicitly deferred).

### 17.5 `rel="modulepreload"` for ESM

When the ESM build is used in a module graph, `rel="modulepreload"` instructs the browser to fetch and parse the module early, before it is imported:

```html
<link rel="modulepreload" href="dist/scripts/praescio.esm.js">
```

This eliminates the waterfall delay between parsing the inline `<script type="module">` and fetching the module.

### 17.6 Expected Lighthouse Scores

Lighthouse scores are measured on `demos/lighthouse.html` with a simulated 4G connection and mid-tier mobile device (Lighthouse default throttling).

| Category | Target Score |
|---|---|
| Performance | 95+ |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

The Performance score of 95+ accounts for the inherent cost of loading a JavaScript library. The remaining three categories should always be 100 given the accessibility-first design (see [Section 8](#8-accessibility-design)), use of semantic HTML, and absence of console errors or deprecated APIs.

---

## 18. Mobile-First Design

### 18.1 Base Styles Target Mobile

All CSS in Praescio is written mobile-first: base rules assume a touch device with a narrow viewport. Desktop enhancements are added inside `@media (min-width: 1280px)` blocks. This ensures the library renders correctly with zero overrides on small screens, with desktop refinements layered on top.

### 18.2 Touch Targets

Every interactive element in the suggestion panel meets the WCAG 2.5.5 minimum touch target size of 44 × 44 px. This is enforced via `--praescio-item-min-height: 2.75rem` (44px at the default 16px root font size). No item may be given a `min-height` below this value via theming.

### 18.3 Pointer Coarse Media Query

Hover states are not applied unconditionally. On touch devices (`pointer: coarse`), `:hover` styles are suppressed and item highlighting is driven solely by `aria-selected`, which is set programmatically by the `A11yController`. This prevents ghost hover states caused by touch events that synthesise `mouseover`.

```css
/* responsive.css */
@media (pointer: coarse) {
  .praescio__item:hover {
    background: transparent; /* override hover; rely on aria-selected instead */
  }
}
```

### 18.4 iOS Zoom Prevention

iOS Safari zooms the viewport when a focused `<input>` has `font-size < 16px`. Praescio prevents this using `max()` in the font-size declaration:

```css
.praescio__panel input,
.praescio__input {
  font-size: max(1rem, 16px);
}
```

The CSS custom property `--praescio-font-size` defaults to `1rem` and is used throughout the panel. Consumer themes that set `--praescio-font-size` to a value below `1rem` should be aware of this constraint; the `max(1rem, ...)` guard on the input element overrides the custom property if it resolves below 16px.

### 18.5 Desktop Breakpoint

The single desktop breakpoint is `1280px`. It is hard-coded in media query declarations (`@media (min-width: 1280px)`) and also documented as the informational CSS token `--praescio-breakpoint: 1280px` on `.praescio__panel`. The token does not affect layout (CSS custom properties cannot be used inside `@media` conditions); it exists purely as a reference for consumers who need to coordinate breakpoints with surrounding page layout.

---

## 19. Tooling

### 19.1 Prettier

Prettier enforces consistent code formatting across all TypeScript, CSS, HTML, and JSON files. It runs as a pre-commit hook (via `lint-staged`) and in CI.

Configuration file: `.prettierrc`

Key settings:
- `printWidth: 100`
- `singleQuote: true`
- `trailingComma: 'all'`
- `semi: true`

### 19.2 ESLint (Flat Config)

ESLint v9+ flat config is used. The configuration file is `.eslintrc.js` (CommonJS export of an array of config objects). TypeScript rules are provided by `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`.

Notable rules:
- `@typescript-eslint/no-explicit-any`: `error`
- `@typescript-eslint/no-floating-promises`: `error`
- `@typescript-eslint/strict-boolean-expressions`: `warn`
- `no-console`: `warn` (informational; stripped by build)

### 19.3 Stylelint

Stylelint validates all CSS source files in `src/styles/`. Configuration file: `.stylelintrc.js`.

Extends: `stylelint-config-standard`

Notable rules:
- `custom-property-pattern`: enforces `--praescio-*` prefix for all custom properties defined inside `.praescio` selectors.
- `color-no-invalid-hex`: `true`
- `declaration-no-important`: warns on `!important` outside `@media print`.
- `selector-class-pattern`: enforces BEM naming (`praescio__*` / `praescio--*`).

### 19.4 PostCSS

PostCSS processes the CSS source during the build. Configuration file: `postcss.config.js`.

Plugins in order:

| Plugin | Purpose |
|---|---|
| `postcss-import` | Inlines all `@import` statements into a single file |
| `postcss-nesting` | Un-nests native CSS Level 3 nesting for older browsers |
| `autoprefixer` | Adds vendor prefixes based on Browserslist targets |
| `cssnano` | Minifies CSS for the `*.min.css` output |

`cssnano` is only applied when building the minified output; the expanded `praescio.css` is produced without it.

Browserslist target (in `package.json`):

```json
"browserslist": ["> 1%", "last 2 versions", "not dead", "not IE 11"]
```

---

## 20. Non-Goals

The following are explicitly out of scope for v1 to keep the plugin focused:

| Out of Scope | Rationale |
|---|---|
| React / Vue / Angular wrappers | Framework wrappers belong in separate packages; the core should be solid first |
| Multi-select / tagging | Different interaction model; better handled by a dedicated component |
| Form validation integration | Out of domain; pair with native constraint validation API if needed |
| Server-side rendering (SSR) | Panel is always client-rendered; hydration is a v2 concern |
| Mobile-native (React Native, etc.) | Web-only scope |
| Full-text search engine | Praescio fetches results; ranking/indexing is the server's job |

---

*Document version: 2026-06-16 | Updated from praescio-plan.md: migrated Styling System from SASS to modern CSS (CSS custom properties, @import organisation, PostCSS pipeline, native nesting); updated Build Outputs to reflect new dist/scripts/ and dist/styles/ structure with no sourcemaps; added Section 16 (Print Support), Section 17 (Performance & Lighthouse), Section 18 (Mobile-First Design), Section 19 (Tooling); updated Module Structure to reflect CSS source files, demos/ directory, and docs/ directory.*
