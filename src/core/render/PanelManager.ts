import { el, scrollableAncestors } from '../../utils/dom';
import { computePanelPosition } from '../../utils/position';
import type { CommonOptions } from '../../types/PraescioOptions';

export class PanelManager {
  readonly panel: HTMLElement;
  private anchor: HTMLElement;
  private options: CommonOptions;
  private isOpen = false;
  private scrollCleanups: Array<() => void> = [];
  private resizeObserver: ResizeObserver | null = null;
  private pendingFrame: number | null = null;

  constructor(panel: HTMLElement, anchor: HTMLElement, options: CommonOptions) {
    this.panel = panel;
    this.anchor = anchor;
    this.options = options;
    this.panel.style.position = 'absolute';
    this.panel.style.zIndex = 'var(--praescio-z-index, 9999)';
    this.panel.style.display = 'none';
    this.panel.style.minWidth = '200px';
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.panel.style.display = '';
    this.reposition();
    this.attachScrollListeners();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.style.display = 'none';
    this.detachScrollListeners();
  }

  reposition(): void {
    if (!this.isOpen) return;
    const panelHeight = this.panel.offsetHeight || 288;
    const rect = computePanelPosition(
      this.anchor,
      panelHeight,
      this.options.offset,
      this.options.placement
    );
    this.panel.style.top = `${rect.top}px`;
    this.panel.style.left = `${rect.left}px`;
    this.panel.style.width = `${rect.width}px`;
    this.panel.dataset['praescioPlacement'] = rect.placement;
  }

  private attachScrollListeners(): void {
    this.detachScrollListeners();
    const onReposition = () => {
      if (this.pendingFrame !== null) cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = requestAnimationFrame(() => {
        this.reposition();
        this.pendingFrame = null;
      });
    };

    const ancestors = scrollableAncestors(this.anchor);
    for (const ancestor of ancestors) {
      ancestor.addEventListener('scroll', onReposition, { passive: true });
      this.scrollCleanups.push(() => ancestor.removeEventListener('scroll', onReposition));
    }
    window.addEventListener('scroll', onReposition, { passive: true });
    this.scrollCleanups.push(() => window.removeEventListener('scroll', onReposition));
    window.addEventListener('resize', onReposition, { passive: true });
    this.scrollCleanups.push(() => window.removeEventListener('resize', onReposition));

    this.resizeObserver = new ResizeObserver(onReposition);
    this.resizeObserver.observe(this.anchor);
  }

  private detachScrollListeners(): void {
    for (const cleanup of this.scrollCleanups) cleanup();
    this.scrollCleanups = [];
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
  }

  destroy(): void {
    this.close();
    this.panel.remove();
  }
}

export function buildPanelShell(
  panelId: string,
  listEl: HTMLElement,
  slots: CommonOptions['slots']
): HTMLElement {
  const panel = el('div', { class: 'praescio__panel', id: panelId });

  if (slots?.header instanceof HTMLElement) {
    const headerWrap = el('div', { class: 'praescio__panel__header' });
    headerWrap.append(slots.header);
    panel.append(headerWrap);
  } else if (typeof slots?.header === 'string') {
    const headerWrap = el('div', { class: 'praescio__panel__header' });
    headerWrap.textContent = slots.header;
    panel.append(headerWrap);
  }

  panel.append(listEl);

  if (slots?.footer instanceof HTMLElement) {
    const footerWrap = el('div', { class: 'praescio__panel__footer' });
    footerWrap.append(slots.footer);
    panel.append(footerWrap);
  }

  return panel;
}
