import { el } from '../../../utils/dom';

/** Render a visual `<hr>` separator with `role="separator"` and `aria-hidden`. */
export function renderDivider(): HTMLElement {
  return el('hr', { class: 'praescio__divider', role: 'separator', 'aria-hidden': 'true' });
}
