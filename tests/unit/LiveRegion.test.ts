import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveRegion } from '../../src/core/a11y/LiveRegion';

describe('LiveRegion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('appends a node to document.body on construction', () => {
    const before = document.body.children.length;
    const lr = new LiveRegion();
    expect(document.body.children.length).toBe(before + 1);
    lr.destroy();
  });

  it('node has class praescio__live', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    expect(node.classList.contains('praescio__live')).toBe(true);
    lr.destroy();
  });

  it('node has role="status" and aria-live="polite"', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    expect(node.getAttribute('role')).toBe('status');
    expect(node.getAttribute('aria-live')).toBe('polite');
    expect(node.getAttribute('aria-atomic')).toBe('true');
    lr.destroy();
  });

  it('announce() sets textContent after 50ms debounce', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.announce('3 results available.');
    expect(node.textContent).toBe('');
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('3 results available.');
    lr.destroy();
  });

  it('announce() clears text after 3000ms', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.announce('hello');
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('hello');
    vi.advanceTimersByTime(3000);
    expect(node.textContent).toBe('');
    lr.destroy();
  });

  it('announceResults uses default message for count > 0', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.announceResults(5, 'par', {} as never);
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('5 results available.');
    lr.destroy();
  });

  it('announceResults uses singular for count === 1', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.announceResults(1, 'par', {} as never);
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('1 result available.');
    lr.destroy();
  });

  it('announceResults uses no-results message for count === 0', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.announceResults(0, 'xyz', {} as never);
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('No results for "xyz".');
    lr.destroy();
  });

  it('announceResults uses custom formatter when provided', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    const announceResults = (count: number, query: string) => `Found ${count} for "${query}"`;
    lr.announceResults(3, 'test', { announceResults } as never);
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('Found 3 for "test"');
    lr.destroy();
  });

  it('announceItem uses default message', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.announceItem({ type: 'text', label: 'Paris' }, 0, 3, {} as never);
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('1 of 3: Paris');
    lr.destroy();
  });

  it('announceItem includes description when present', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.announceItem(
      { type: 'description', label: 'TypeScript', description: 'Typed JS' },
      1,
      5,
      {} as never
    );
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('2 of 5: TypeScript — Typed JS');
    lr.destroy();
  });

  it('announceItem uses custom formatter when provided', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    const announceItem = (_item: unknown, index: number, total: number) =>
      `Item ${index + 1} of ${total}`;
    lr.announceItem({ type: 'text', label: 'X' }, 2, 10, { announceItem } as never);
    vi.advanceTimersByTime(50);
    expect(node.textContent).toBe('Item 3 of 10');
    lr.destroy();
  });

  it('destroy() removes the node from the DOM', () => {
    const lr = new LiveRegion();
    const node = document.body.lastElementChild as HTMLElement;
    lr.destroy();
    expect(document.body.contains(node)).toBe(false);
  });
});
