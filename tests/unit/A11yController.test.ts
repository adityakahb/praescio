import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A11yController } from '../../src/core/a11y/A11yController';
import type { ListRenderer } from '../../src/core/render/ListRenderer';
import type { LiveRegion } from '../../src/core/a11y/LiveRegion';
import type { CommonOptions } from '../../src/types/PraescioOptions';

const OPTIONS: CommonOptions = {
  highlight: true,
  minChars: 1,
  maxItems: 10,
  cache: 'none',
  cacheTTL: 0,
  selectOnTab: true,
  closeOnSelect: true,
  openOnFocus: false,
  showEmpty: true,
  virtualScroll: false,
  placement: 'auto',
  offset: 4,
  debounce: 300,
  ariaLabel: 'Suggestions',
  plugins: [],
} as unknown as CommonOptions;

function makeInput(): HTMLInputElement {
  return document.createElement('input');
}

function makeListRenderer(itemNode?: HTMLElement): ListRenderer {
  return {
    listEl: document.createElement('div'),
    getItemAtSelectableIndex: vi
      .fn()
      .mockReturnValue(itemNode ? { type: 'text', label: 'Paris' } : undefined),
    getSelectableNodeAt: vi.fn().mockReturnValue(itemNode ?? null),
  } as unknown as ListRenderer;
}

function makeLiveRegion(): LiveRegion {
  return {
    announceResults: vi.fn(),
    announceItem: vi.fn(),
  } as unknown as LiveRegion;
}

// ── Construction / ARIA init ──────────────────────────────────────────────────

describe('A11yController — initInputARIA', () => {
  it('sets role="combobox" on the input', () => {
    const input = makeInput();
    new A11yController(input, makeListRenderer(), makeLiveRegion(), 'list-1', OPTIONS);
    expect(input.getAttribute('role')).toBe('combobox');
  });

  it('sets aria-autocomplete="list"', () => {
    const input = makeInput();
    new A11yController(input, makeListRenderer(), makeLiveRegion(), 'list-1', OPTIONS);
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
  });

  it('sets aria-haspopup="listbox"', () => {
    const input = makeInput();
    new A11yController(input, makeListRenderer(), makeLiveRegion(), 'list-1', OPTIONS);
    expect(input.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('sets aria-expanded="false" initially', () => {
    const input = makeInput();
    new A11yController(input, makeListRenderer(), makeLiveRegion(), 'list-1', OPTIONS);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('sets aria-controls to the listId', () => {
    const input = makeInput();
    new A11yController(input, makeListRenderer(), makeLiveRegion(), 'my-list', OPTIONS);
    expect(input.getAttribute('aria-controls')).toBe('my-list');
  });

  it('disables browser autocomplete and spellcheck', () => {
    const input = makeInput();
    new A11yController(input, makeListRenderer(), makeLiveRegion(), 'list-1', OPTIONS);
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });
});

// ── handleStatusChange ────────────────────────────────────────────────────────

describe('A11yController — handleStatusChange', () => {
  let input: HTMLInputElement;
  let liveRegion: LiveRegion;
  let controller: A11yController;

  beforeEach(() => {
    input = makeInput();
    liveRegion = makeLiveRegion();
    controller = new A11yController(input, makeListRenderer(), liveRegion, 'list-1', OPTIONS);
  });

  it('sets aria-expanded="true" when status is "open"', () => {
    controller.handleStatusChange('open', 'par', [{ type: 'text', label: 'Paris' }]);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('sets aria-expanded="false" when status is "closed"', () => {
    controller.handleStatusChange('open', 'par', []);
    controller.handleStatusChange('closed', '', []);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('calls announceResults on "open"', () => {
    const items = [{ type: 'text' as const, label: 'Paris' }];
    controller.handleStatusChange('open', 'par', items);
    expect(liveRegion.announceResults).toHaveBeenCalledOnce();
    expect(liveRegion.announceResults).toHaveBeenCalledWith(1, 'par', OPTIONS);
  });

  it('excludes group and divider items from selectable count', () => {
    const items = [
      { type: 'group' as const, label: 'Cities' },
      { type: 'text' as const, label: 'Paris' },
      { type: 'divider' as const },
      { type: 'text' as const, label: 'London' },
    ];
    controller.handleStatusChange('open', '', items);
    expect(liveRegion.announceResults).toHaveBeenCalledWith(2, '', OPTIONS);
  });

  it('calls announceResults(0) on "empty" status', () => {
    controller.handleStatusChange('empty', 'xyz', []);
    expect(liveRegion.announceResults).toHaveBeenCalledWith(0, 'xyz', OPTIONS);
  });

  it('does not call announceResults for unrelated statuses', () => {
    controller.handleStatusChange('loading', '', []);
    expect(liveRegion.announceResults).not.toHaveBeenCalled();
  });
});

// ── handleHighlightChange ─────────────────────────────────────────────────────

describe('A11yController — handleHighlightChange', () => {
  it('does nothing when index is -1', () => {
    const liveRegion = makeLiveRegion();
    const c = new A11yController(makeInput(), makeListRenderer(), liveRegion, 'l', OPTIONS);
    c.handleHighlightChange(-1, [], 0);
    expect(liveRegion.announceItem).not.toHaveBeenCalled();
  });

  it('calls announceItem for a valid index', () => {
    const liveRegion = makeLiveRegion();
    const renderer = makeListRenderer(document.createElement('div'));
    const c = new A11yController(makeInput(), renderer, liveRegion, 'l', OPTIONS);
    const items = [{ type: 'text' as const, label: 'Paris' }];
    c.handleHighlightChange(0, items, 3);
    expect(liveRegion.announceItem).toHaveBeenCalledOnce();
  });

  it('does nothing when the item node is not found', () => {
    const liveRegion = makeLiveRegion();
    const renderer = makeListRenderer();
    const c = new A11yController(makeInput(), renderer, liveRegion, 'l', OPTIONS);
    c.handleHighlightChange(0, [{ type: 'text', label: 'Paris' }], 1);
    expect(liveRegion.announceItem).not.toHaveBeenCalled();
  });
});
