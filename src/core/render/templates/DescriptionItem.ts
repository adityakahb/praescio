import { el } from '../../../utils/dom';
import { buildHighlightFragment } from '../../../utils/highlight';
import type { DescriptionItem } from '../../../types/SuggestionItem';

/** Render a `description` suggestion item: label on top, description below. */
export function renderDescriptionItem(
  item: DescriptionItem,
  itemId: string,
  query: string,
  highlight: boolean
): HTMLElement {
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
