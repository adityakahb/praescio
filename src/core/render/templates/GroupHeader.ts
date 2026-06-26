import { el } from '../../../utils/dom';
import { buildIcon } from './icon';
import type { GroupHeader } from '../../../types/SuggestionItem';

/**
 * Render a non-selectable `group` header with `role="group"`.
 * An optional icon is rendered before the label text using {@link buildIcon}.
 */
export function renderGroupHeader(item: GroupHeader, groupId: string): HTMLElement {
  const node = el('div', {
    class: 'praescio__group',
    role: 'group',
    'aria-label': item.label,
    id: groupId,
  });
  const labelEl = el('span', { class: 'praescio__group__label' });
  if (item.icon) {
    labelEl.append(buildIcon(item.icon));
  }
  labelEl.append(document.createTextNode(item.label));
  node.append(labelEl);
  return node;
}
