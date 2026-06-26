import { el, sanitizeHref } from '../../../utils/dom';
import { buildHighlightFragment } from '../../../utils/highlight';
import { buildIcon } from './icon';
import type { RichItem } from '../../../types/SuggestionItem';

/**
 * Render a `rich` suggestion item: optional icon, label, optional description,
 * and optional badge. When the item has an `href` the root element is an `<a>`;
 * otherwise a `<div>`. The `href` is sanitized to block `javascript:` injection.
 */
export function renderRichItem(
  item: RichItem,
  itemId: string,
  query: string,
  highlight: boolean
): HTMLElement {
  const tag = item.href ? 'a' : 'div';
  const attrs: Record<string, string> = {
    class: 'praescio__item praescio__item--rich',
    role: 'option',
    tabindex: '-1',
    'aria-selected': 'false',
    id: itemId,
  };
  if (item.href) {
    attrs['href'] = sanitizeHref(item.href);
    attrs['target'] = item.target ?? '_self';
    if (item.target === '_blank') attrs['rel'] = 'noopener noreferrer';
  }
  const node = el(tag as 'div', attrs);

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
