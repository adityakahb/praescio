/**
 * A plain-text suggestion — the simplest item type.
 *
 * @example
 * ```ts
 * { type: 'text', label: 'Apple', value: 'apple' }
 * ```
 */
export interface TextItem {
  type: 'text';
  /** Display label shown in the panel. */
  label: string;
  /** Value written to the input on selection. Defaults to `label` when omitted. */
  value?: string;
  /** Arbitrary extra data carried along for use in event handlers. */
  meta?: Record<string, unknown>;
}

/**
 * A suggestion with a secondary description line below the label.
 *
 * @example
 * ```ts
 * { type: 'description', label: 'TypeScript', description: 'Typed JavaScript at any scale' }
 * ```
 */
export interface DescriptionItem {
  type: 'description';
  label: string;
  /** Supplementary text rendered below the label. */
  description: string;
  value?: string;
  meta?: Record<string, unknown>;
}

/**
 * A suggestion that navigates to a URL on selection.
 *
 * The item is rendered as an `<a>` element. On **click** the browser follows
 * `href` naturally; the panel is closed and the `select` event fires, but the
 * input value is **not** changed. On **keyboard Enter** the navigation is
 * triggered programmatically via `window.location` (or `window.open` for
 * `target: '_blank'`).
 *
 * `href` values are sanitized at render time — `javascript:` and `vbscript:`
 * URIs are replaced with `'#'`.
 *
 * @example
 * ```ts
 * { type: 'link', label: 'GitHub', href: 'https://github.com', target: '_blank' }
 * ```
 */
export interface LinkItem {
  type: 'link';
  label: string;
  /** Navigation target URL. Sanitized at render time to block `javascript:` URIs. */
  href: string;
  /** Link target attribute. Defaults to `_self`. */
  target?: '_self' | '_blank';
  description?: string;
  meta?: Record<string, unknown>;
}

/**
 * A suggestion with a leading icon.
 *
 * @example SVG icon
 * ```ts
 * { type: 'icon', label: 'Settings', icon: '<svg>…</svg>' }
 * ```
 *
 * @example Icon font class
 * ```ts
 * { type: 'icon', label: 'Home', icon: 'fa fa-home', iconAlt: 'home icon' }
 * ```
 */
export interface IconItem {
  type: 'icon';
  label: string;
  /** SVG string, absolute/relative URL, or icon-font class. */
  icon: string;
  /** Omit for decorative icons; provide for meaningful icons. */
  iconAlt?: string;
  value?: string;
  meta?: Record<string, unknown>;
}

/**
 * A rich suggestion combining icon, label, description, badge, and optional link.
 *
 * This is the most versatile item type — use it for search-result cards,
 * command-palette entries, or user lookup results.
 *
 * @example
 * ```ts
 * {
 *   type: 'rich',
 *   label: 'John Doe',
 *   description: 'Engineering · San Francisco',
 *   icon: '/avatars/john.jpg',
 *   badge: 'Admin',
 *   value: 'john.doe',
 * }
 * ```
 */
export interface RichItem {
  type: 'rich';
  label: string;
  description?: string;
  href?: string;
  target?: '_self' | '_blank';
  icon?: string;
  iconAlt?: string;
  /** Small badge label rendered to the right of the icon. */
  badge?: string;
  value?: string;
  meta?: Record<string, unknown>;
}

/**
 * A non-selectable group header rendered between items.
 * Injected automatically by the `groupBy` option, or supplied manually.
 *
 * @example
 * ```ts
 * { type: 'group', label: 'Recent' }
 * ```
 */
export interface GroupHeader {
  type: 'group';
  label: string;
  icon?: string;
  collapsible?: boolean;
}

/**
 * A visual divider line between items or groups. Non-selectable.
 *
 * @example
 * ```ts
 * { type: 'divider' }
 * ```
 */
export interface DividerItem {
  type: 'divider';
}

/**
 * A fully custom item rendered by user-supplied code or raw HTML markup.
 *
 * Two rendering modes are supported:
 *
 * **`render` callback** — receives the container element and the current
 * query string; ideal for dynamic content or when cleanup is needed.
 * Return a cleanup function to release resources when the item is removed.
 *
 * **`html` string** — set directly as `innerHTML` when no `render` is
 * provided. Allows images, formatted text, or any inline markup.
 * **The caller is responsible for sanitizing this value** — never pass
 * unescaped user input here.
 *
 * `render` takes precedence over `html` when both are present.
 *
 * @example Render callback
 * ```ts
 * {
 *   type: 'custom',
 *   label: 'Create "react"',
 *   render(container, query) {
 *     container.innerHTML = `<strong>+ Create "${query}"</strong>`;
 *   },
 * }
 * ```
 *
 * @example HTML markup (image + text)
 * ```ts
 * {
 *   type: 'custom',
 *   label: 'Acme Corp',
 *   html: '<img src="/logos/acme.png" alt=""> <span>Acme Corp</span>',
 * }
 * ```
 */
export interface CustomItem {
  type: 'custom';
  /**
   * Called with the container element and the current query string.
   * Takes precedence over `html`. May return a cleanup function that is
   * called before the item is removed from the DOM.
   */
  render?: (container: HTMLElement, query: string) => void | (() => void);
  /**
   * Raw HTML string rendered as the item's inner markup.
   * Used only when `render` is not provided.
   * **Caller is responsible for sanitization — do not interpolate raw user input.**
   */
  html?: string;
  /** Used for screen reader announcements even with custom rendering. */
  label: string;
  value?: string;
  meta?: Record<string, unknown>;
}

/**
 * Union of all item types that can appear in the suggestion panel.
 * Use the `type` discriminant to narrow to a specific shape.
 */
export type SuggestionItem =
  | TextItem
  | DescriptionItem
  | LinkItem
  | IconItem
  | RichItem
  | GroupHeader
  | DividerItem
  | CustomItem;

/** Items that a user can actually select (excludes structural `group` and `divider`). */
export type SelectableItem = Exclude<SuggestionItem, GroupHeader | DividerItem>;

/** Type guard — returns `true` for items the user can highlight and select. */
export function isSelectable(item: SuggestionItem): item is SelectableItem {
  return item.type !== 'group' && item.type !== 'divider';
}

/**
 * Returns the canonical string value of a selectable item.
 * For links this is `href`; for other types it is `value ?? label`.
 */
export function getItemValue(item: SelectableItem): string {
  if (item.type === 'link') return item.href;
  if ('value' in item && item.value !== undefined) return item.value;
  return item.label;
}
