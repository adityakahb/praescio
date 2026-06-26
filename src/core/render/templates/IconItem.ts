import { el } from '../../../utils/dom';
import { buildHighlightFragment } from '../../../utils/highlight';
import { buildIcon } from './icon';
import type { IconItem } from '../../../types/SuggestionItem';

/**
 * Render an `icon` suggestion item: leading icon followed by a text label.
 * Icon strings are resolved by {@link buildIcon} — SVG, URL, or CSS class.
 */
export function renderIconItem(
  item: IconItem,
  itemId: string,
  query: string,
  highlight: boolean
): HTMLElement {
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
