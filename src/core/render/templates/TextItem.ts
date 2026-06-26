import { el } from '../../../utils/dom';
import { buildHighlightFragment } from '../../../utils/highlight';
import type { TextItem } from '../../../types/SuggestionItem';

/** Render a `text` suggestion item as a plain labelled `<div>`. */
export function renderTextItem(
  item: TextItem,
  itemId: string,
  query: string,
  highlight: boolean
): HTMLElement {
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
