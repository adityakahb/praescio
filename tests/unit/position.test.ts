import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computePanelPosition } from '../../src/utils/position';

function fakeAnchor(rect: DOMRect): HTMLElement {
  return {
    getBoundingClientRect: () => rect,
  } as unknown as HTMLElement;
}

describe('computePanelPosition', () => {
  beforeEach(() => {
    // Viewport: 1024 × 768, no scroll
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('places the panel below the anchor (preferred=auto, enough space below)', () => {
    const anchor = fakeAnchor(DOMRect.fromRect({ x: 100, y: 100, width: 300, height: 40 }));
    const result = computePanelPosition(anchor, 200, 4, 'auto');
    expect(result.placement).toBe('bottom');
    // top should be anchor.bottom + scrollY + offset = 140 + 0 + 4 = 144
    expect(result.top).toBe(144);
    expect(result.left).toBe(100);
    expect(result.width).toBe(300);
  });

  it('places the panel above when space below is insufficient', () => {
    // Anchor near bottom of viewport
    const anchor = fakeAnchor(DOMRect.fromRect({ x: 100, y: 680, width: 300, height: 40 }));
    const result = computePanelPosition(anchor, 200, 4, 'auto');
    // spaceBelow = 768 - 720 - 4 = 44; spaceAbove = 680 - 4 = 676 → top
    expect(result.placement).toBe('top');
    // top = anchorRect.top + scrollY - panelHeight - offset = 680 - 200 - 4 = 476
    expect(result.top).toBe(476);
  });

  it('respects preferred placement "bottom" even with little space below', () => {
    const anchor = fakeAnchor(DOMRect.fromRect({ x: 0, y: 750, width: 200, height: 18 }));
    const result = computePanelPosition(anchor, 300, 4, 'bottom');
    expect(result.placement).toBe('bottom');
  });

  it('respects preferred placement "top"', () => {
    const anchor = fakeAnchor(DOMRect.fromRect({ x: 0, y: 200, width: 200, height: 40 }));
    const result = computePanelPosition(anchor, 100, 4, 'top');
    expect(result.placement).toBe('top');
  });

  it('clamps left so the panel stays within the viewport', () => {
    // Anchor near the right edge; panel would overflow
    const anchor = fakeAnchor(DOMRect.fromRect({ x: 900, y: 100, width: 300, height: 40 }));
    const result = computePanelPosition(anchor, 200, 4, 'bottom');
    // panelWidth = min(300, 1024) = 300; left should be clamped to 1024 - 300 = 724
    expect(result.left).toBe(724);
  });

  it('does not allow left to go negative', () => {
    const anchor = fakeAnchor(DOMRect.fromRect({ x: -50, y: 100, width: 100, height: 40 }));
    const result = computePanelPosition(anchor, 200, 4, 'bottom');
    expect(result.left).toBeGreaterThanOrEqual(0);
  });

  it('accounts for page scrollX and scrollY', () => {
    Object.defineProperty(window, 'scrollX', { value: 50, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    const anchor = fakeAnchor(DOMRect.fromRect({ x: 100, y: 100, width: 200, height: 40 }));
    const result = computePanelPosition(anchor, 150, 4, 'bottom');
    // top = anchorRect.bottom + scrollY + offset = 140 + 100 + 4 = 244
    expect(result.top).toBe(244);
    // left = anchorRect.left + scrollX = 100 + 50 = 150
    expect(result.left).toBe(150);
  });
});
