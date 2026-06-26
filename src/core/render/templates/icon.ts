import { sanitizeHref } from '../../../utils/dom';

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
export function buildIcon(icon: string, alt?: string): HTMLElement {
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
  } else if (trimmed.startsWith('<img')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'text/html');
    const imgEl = doc.querySelector('img');
    if (imgEl) {
      const src = imgEl.getAttribute('src') ?? '';
      const imgAlt = alt ?? imgEl.getAttribute('alt') ?? undefined;
      wrapper.appendChild(buildImgIcon(src, imgAlt));
    }
  } else if (isUrl(icon)) {
    wrapper.appendChild(buildImgIcon(icon, alt));
  } else {
    // CSS class-based icon (e.g. icon fonts)
    const span = document.createElement('span');
    span.className = icon;
    if (!alt) span.setAttribute('aria-hidden', 'true');
    else span.setAttribute('aria-label', alt);
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
function sanitizeSvgElement(svg: Element): void {
  svg.querySelectorAll('script').forEach((el) => el.remove());

  // Remove <use> elements pointing at external resources; fragment-only
  // references (e.g. #icon-id) that reference symbols in the same SVG are fine.
  svg.querySelectorAll('use').forEach((use) => {
    const href =
      use.getAttribute('href') ?? use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '';
    if (href && !href.startsWith('#')) use.remove();
  });

  const elements = [svg, ...Array.from(svg.querySelectorAll('*'))];
  for (const el of elements) {
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) {
        attrsToRemove.push(attr.name);
      } else if (attr.name === 'href' || attr.name === 'xlink:href') {
        if (sanitizeHref(attr.value) === '#') attrsToRemove.push(attr.name);
      }
    }
    for (const name of attrsToRemove) el.removeAttribute(name);
  }
}

function buildImgIcon(src: string, alt?: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt ?? '';
  if (!alt) img.setAttribute('aria-hidden', 'true');
  img.className = 'praescio__item__icon-img';
  return img;
}

/**
 * Returns `true` when the string looks like a URL or image path rather than
 * a CSS class string. Only `data:image/` URIs are allowed to prevent
 * non-image data URIs from being passed to `<img src>`.
 */
function isUrl(s: string): boolean {
  return (
    s.startsWith('http') ||
    s.startsWith('//') ||
    s.startsWith('data:image/') ||
    s.startsWith('/') ||
    /\.(png|jpg|jpeg|gif|svg|webp)(\?|$)/i.test(s)
  );
}
