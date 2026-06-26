import type { SuggestionItem } from '../../types/SuggestionItem';
import { renderTextItem } from './templates/TextItem';
import { renderDescriptionItem } from './templates/DescriptionItem';
import { renderLinkItem } from './templates/LinkItem';
import { renderIconItem } from './templates/IconItem';
import { renderRichItem } from './templates/RichItem';
import { renderGroupHeader } from './templates/GroupHeader';
import { renderDivider } from './templates/DividerItem';
import { renderCustomItem } from './templates/CustomItem';
import { uid } from '../../utils/uid';

/** A rendered DOM node together with an optional teardown function. */
export interface RenderedItem {
  node: HTMLElement;
  /** Present only for `custom` items whose `render` callback returned a cleanup function. */
  cleanup?: () => void;
}

/**
 * Dispatch a {@link SuggestionItem} to the correct template renderer and
 * return the resulting DOM node wrapped in a {@link RenderedItem}.
 *
 * Every selectable item receives a stable, unique `id` attribute so that
 * `aria-activedescendant` can reference it from the combobox input.
 *
 * @param item - The suggestion item to render.
 * @param query - The current query string; passed to templates for highlight matching.
 * @param highlight - Whether to wrap matched text in `<mark>` elements.
 */
export function renderItem(item: SuggestionItem, query: string, highlight: boolean): RenderedItem {
  const itemId = uid('praescio-item');

  switch (item.type) {
    case 'text':
      return { node: renderTextItem(item, itemId, query, highlight) };
    case 'description':
      return { node: renderDescriptionItem(item, itemId, query, highlight) };
    case 'link':
      return { node: renderLinkItem(item, itemId, query, highlight) };
    case 'icon':
      return { node: renderIconItem(item, itemId, query, highlight) };
    case 'rich':
      return { node: renderRichItem(item, itemId, query, highlight) };
    case 'group':
      return { node: renderGroupHeader(item, uid('praescio-group')) };
    case 'divider':
      return { node: renderDivider() };
    case 'custom': {
      const { node, cleanup } = renderCustomItem(item, itemId, query);
      return { node, cleanup };
    }
  }
}
