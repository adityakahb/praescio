import type { PanelPlacement } from '../types/PraescioOptions';

export interface PanelRect {
  top: number;
  left: number;
  width: number;
  placement: 'top' | 'bottom';
}

/**
 * Compute the panel's CSS position relative to the viewport.
 * Clamps the result so the panel never exits the viewport.
 */
export function computePanelPosition(
  anchor: HTMLElement,
  panelHeight: number,
  offset: number,
  preferredPlacement: PanelPlacement
): PanelRect {
  const anchorRect = anchor.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  const spaceBelow = viewportH - anchorRect.bottom - offset;
  const spaceAbove = anchorRect.top - offset;

  let placement: 'top' | 'bottom';
  if (preferredPlacement === 'auto') {
    placement = spaceBelow >= panelHeight || spaceBelow >= spaceAbove ? 'bottom' : 'top';
  } else {
    placement = preferredPlacement;
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let top: number;
  if (placement === 'bottom') {
    top = anchorRect.bottom + scrollY + offset;
  } else {
    top = anchorRect.top + scrollY - panelHeight - offset;
  }

  // Clamp left so the panel stays within the viewport
  let left = anchorRect.left + scrollX;
  const panelWidth = Math.min(anchorRect.width, viewportW);
  if (left + panelWidth > scrollX + viewportW) {
    left = scrollX + viewportW - panelWidth;
  }
  if (left < scrollX) left = scrollX;

  return { top, left, width: anchorRect.width, placement };
}
