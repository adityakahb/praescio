import { el, sanitizeHref } from '../../../utils/dom';
import { buildHighlightFragment } from '../../../utils/highlight';
import type { LinkItem } from '../../../types/SuggestionItem';

/**
 * Render a `link` suggestion item as an `<a>` element.
 *
 * The `href` is sanitized to prevent `javascript:` and `vbscript:` injection.
 * Clicking the element navigates naturally via the browser; the selection
 * handler closes the panel and fires the `select` event without touching the
 * input value.
 */
export function renderLinkItem(
  item: LinkItem,
  itemId: string,
  query: string,
  highlight: boolean
): HTMLElement {
  const node = el('a', {
    class: 'praescio__item praescio__item--link',
    role: 'option',
    tabindex: '-1',
    'aria-selected': 'false',
    id: itemId,
    href: sanitizeHref(item.href),
    target: item.target ?? '_self',
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
