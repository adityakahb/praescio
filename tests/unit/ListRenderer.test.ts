import { describe, it, expect, beforeAll } from 'vitest';
import { ListRenderer } from '../../src/core/render/ListRenderer';
import type { SuggestionItem } from '../../src/types/SuggestionItem';

// jsdom does not implement scrollIntoView; stub it globally
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = () => undefined;
});

function makeRenderer(overrides?: Partial<Parameters<typeof ListRenderer>[1]>): ListRenderer {
  return new ListRenderer('list-test', {
    highlight: true,
    minChars: 1,
    maxItems: 10,
    cache: 'query',
    cacheTTL: 300_000,
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
    ...overrides,
  } as never);
}

const textItems: SuggestionItem[] = [
  { type: 'text', label: 'Paris' },
  { type: 'text', label: 'London' },
  { type: 'text', label: 'Berlin' },
];

// ── Construction ─────────────────────────────────────────────────────────────

describe('ListRenderer — construction', () => {
  it('creates a div with class praescio__list and role="listbox"', () => {
    const r = makeRenderer();
    expect(r.listEl.tagName).toBe('DIV');
    expect(r.listEl.classList.contains('praescio__list')).toBe(true);
    expect(r.listEl.getAttribute('role')).toBe('listbox');
  });

  it('sets the given listId on the listEl', () => {
    const r = new ListRenderer('my-list', {} as never);
    expect(r.listEl.id).toBe('my-list');
  });

  it('sets aria-label from options', () => {
    const r = makeRenderer();
    expect(r.listEl.getAttribute('aria-label')).toBe('Suggestions');
  });
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('ListRenderer — render()', () => {
  it('renders items as [role="option"] elements', () => {
    const r = makeRenderer();
    r.render(textItems, 'par');
    expect(r.listEl.querySelectorAll('[role="option"]').length).toBe(3);
  });

  it('renders items with praescio__item class', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    const items = r.listEl.querySelectorAll('.praescio__item');
    expect(items.length).toBe(3);
  });

  it('clears previous render before rendering new items', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    r.render([{ type: 'text', label: 'Only one' }], '');
    expect(r.listEl.querySelectorAll('[role="option"]').length).toBe(1);
  });

  it('skips non-selectable group and divider items in selectable count', () => {
    const r = makeRenderer();
    const mixed: SuggestionItem[] = [
      { type: 'group', label: 'Cities' },
      { type: 'text', label: 'Paris' },
      { type: 'divider' },
      { type: 'text', label: 'London' },
    ];
    r.render(mixed, '');
    expect(r.getSelectableCount()).toBe(2);
  });

  it('getItemAtSelectableIndex returns the correct item', () => {
    const r = makeRenderer();
    const mixed: SuggestionItem[] = [
      { type: 'group', label: 'Cities' },
      { type: 'text', label: 'Paris' },
      { type: 'text', label: 'London' },
    ];
    r.render(mixed, '');
    expect(r.getItemAtSelectableIndex(0)?.label).toBe('Paris');
    expect(r.getItemAtSelectableIndex(1)?.label).toBe('London');
    expect(r.getItemAtSelectableIndex(2)).toBeUndefined();
  });

  it('renders highlight marks when highlight=true', () => {
    const r = makeRenderer({ highlight: true } as never);
    r.render([{ type: 'text', label: 'Paris' }], 'par');
    expect(r.listEl.querySelector('mark')).not.toBeNull();
  });

  it('omits highlight marks when highlight=false', () => {
    const r = makeRenderer({ highlight: false } as never);
    r.render([{ type: 'text', label: 'Paris' }], 'par');
    expect(r.listEl.querySelector('mark')).toBeNull();
  });
});

// ── setHighlighted ────────────────────────────────────────────────────────────

describe('ListRenderer — setHighlighted()', () => {
  it('adds praescio__item--highlighted and aria-selected to the target item', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    r.setHighlighted(1);
    const items = r.listEl.querySelectorAll('[role="option"]');
    expect(items[1]!.classList.contains('praescio__item--highlighted')).toBe(true);
    expect(items[1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('clears previous highlight when a new index is set', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    r.setHighlighted(0);
    r.setHighlighted(2);
    const items = r.listEl.querySelectorAll('[role="option"]');
    expect(items[0]!.classList.contains('praescio__item--highlighted')).toBe(false);
    expect(items[0]!.getAttribute('aria-selected')).toBe('false');
    expect(items[2]!.classList.contains('praescio__item--highlighted')).toBe(true);
  });

  it('clears all highlights when index is -1', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    r.setHighlighted(0);
    r.setHighlighted(-1);
    const highlighted = r.listEl.querySelectorAll('.praescio__item--highlighted');
    expect(highlighted.length).toBe(0);
  });
});

// ── showSlot ─────────────────────────────────────────────────────────────────

describe('ListRenderer — showSlot()', () => {
  it('renders the loading slot with default text', () => {
    const r = makeRenderer();
    r.showSlot('loading');
    const slot = r.listEl.querySelector('.praescio__slot--loading');
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toBe('Loading…');
  });

  it('renders the empty slot with default text', () => {
    const r = makeRenderer();
    r.showSlot('empty');
    const slot = r.listEl.querySelector('.praescio__slot--empty');
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toBe('No results found.');
  });

  it('renders the error slot with default text', () => {
    const r = makeRenderer();
    r.showSlot('error');
    const slot = r.listEl.querySelector('.praescio__slot--error');
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toContain('error');
  });

  it('renders a custom string content in the slot', () => {
    const r = makeRenderer();
    r.showSlot('empty', 'Nothing matched your search.');
    expect(r.listEl.querySelector('.praescio__slot--empty')!.textContent).toBe(
      'Nothing matched your search.'
    );
  });

  it('renders a custom HTMLElement content in the slot', () => {
    const r = makeRenderer();
    const custom = document.createElement('strong');
    custom.textContent = 'Custom!';
    r.showSlot('loading', custom);
    expect(r.listEl.querySelector('strong')?.textContent).toBe('Custom!');
  });

  it('clears the list before showing a slot', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    r.showSlot('loading');
    expect(r.listEl.querySelectorAll('[role="option"]').length).toBe(0);
    expect(r.listEl.querySelector('.praescio__slot--loading')).not.toBeNull();
  });
});

// ── appendSlotNode ────────────────────────────────────────────────────────────

describe('ListRenderer — appendSlotNode()', () => {
  it('inserts before existing content when position is "before"', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    const node = document.createElement('div');
    node.id = 'before-node';
    r.appendSlotNode('before', node);
    expect(r.listEl.firstChild).toBe(node);
  });

  it('appends after existing content when position is "after"', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    const node = document.createElement('div');
    node.id = 'after-node';
    r.appendSlotNode('after', node);
    expect(r.listEl.lastChild).toBe(node);
  });
});

// ── focusItem ─────────────────────────────────────────────────────────────────

describe('ListRenderer — focusItem()', () => {
  it('does not throw for an out-of-range index', () => {
    const r = makeRenderer();
    r.render(textItems, '');
    expect(() => r.focusItem(99)).not.toThrow();
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('ListRenderer — destroy()', () => {
  it('removes the listEl from the DOM', () => {
    const r = makeRenderer();
    document.body.appendChild(r.listEl);
    r.destroy();
    expect(document.body.contains(r.listEl)).toBe(false);
  });
});
