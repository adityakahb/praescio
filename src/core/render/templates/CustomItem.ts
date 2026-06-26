import { el } from '../../../utils/dom';
import type { CustomItem } from '../../../types/SuggestionItem';

/**
 * Render a `custom` suggestion item.
 *
 * If `item.render` is provided it is called with the container element and
 * the current query string and may return a cleanup function. Otherwise, if
 * `item.html` is provided it is written as `innerHTML` (caller is responsible
 * for sanitization). If neither is supplied the container is left empty.
 */
export function renderCustomItem(
  item: CustomItem,
  itemId: string,
  query: string
): { node: HTMLElement; cleanup: (() => void) | undefined } {
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
