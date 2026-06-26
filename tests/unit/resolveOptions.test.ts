import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../../src/types/PraescioOptions';

const source = ['a', 'b'];

describe('resolveOptions — defaults', () => {
  it('fills in every optional field with its default value', () => {
    const opts = resolveOptions({ source });

    expect(opts.source).toBe(source);
    expect(opts.debounce).toBe(300);
    expect(opts.minChars).toBe(1);
    expect(opts.maxItems).toBe(10);
    expect(opts.cache).toBe('query');
    expect(opts.cacheTTL).toBe(300_000);
    expect(opts.selectOnTab).toBe(true);
    expect(opts.closeOnSelect).toBe(true);
    expect(opts.openOnFocus).toBe(false);
    expect(opts.highlight).toBe(true);
    expect(opts.showEmpty).toBe(true);
    expect(opts.virtualScroll).toBe('auto');
    expect(opts.placement).toBe('auto');
    expect(opts.offset).toBe(4);
    expect(opts.ariaLabel).toBe('Suggestions');
    expect(opts.plugins).toEqual([]);
  });

  it('passes through optional callbacks as undefined when not provided', () => {
    const opts = resolveOptions({ source });
    expect(opts.onOpen).toBeUndefined();
    expect(opts.onClose).toBeUndefined();
    expect(opts.onSelect).toBeUndefined();
    expect(opts.onQuery).toBeUndefined();
    expect(opts.onFetchStart).toBeUndefined();
    expect(opts.onFetchEnd).toBeUndefined();
    expect(opts.onFetchError).toBeUndefined();
    expect(opts.onHighlight).toBeUndefined();
    expect(opts.onEmpty).toBeUndefined();
    expect(opts.onDestroy).toBeUndefined();
    expect(opts.slots).toBeUndefined();
    expect(opts.transform).toBeUndefined();
    expect(opts.groupBy).toBeUndefined();
    expect(opts.sortGroups).toBeUndefined();
    expect(opts.trigger).toBeUndefined();
    expect(opts.insertTemplate).toBeUndefined();
    expect(opts.container).toBeUndefined();
    expect(opts.announceResults).toBeUndefined();
    expect(opts.announceItem).toBeUndefined();
  });
});

describe('resolveOptions — consumer overrides', () => {
  it('honours every overridden value', () => {
    const onSelect = () => undefined;
    const opts = resolveOptions({
      source,
      debounce: 150,
      minChars: 3,
      maxItems: 5,
      cache: 'stale-while-revalidate',
      cacheTTL: 60_000,
      selectOnTab: false,
      closeOnSelect: false,
      openOnFocus: true,
      highlight: false,
      showEmpty: false,
      virtualScroll: 'off',
      placement: 'top',
      offset: 8,
      ariaLabel: 'Search results',
      onSelect,
    });

    expect(opts.debounce).toBe(150);
    expect(opts.minChars).toBe(3);
    expect(opts.maxItems).toBe(5);
    expect(opts.cache).toBe('stale-while-revalidate');
    expect(opts.cacheTTL).toBe(60_000);
    expect(opts.selectOnTab).toBe(false);
    expect(opts.closeOnSelect).toBe(false);
    expect(opts.openOnFocus).toBe(true);
    expect(opts.highlight).toBe(false);
    expect(opts.showEmpty).toBe(false);
    expect(opts.virtualScroll).toBe('off');
    expect(opts.placement).toBe('top');
    expect(opts.offset).toBe(8);
    expect(opts.ariaLabel).toBe('Search results');
    expect(opts.onSelect).toBe(onSelect);
  });

  it('honours zero for numeric options (debounce=0, minChars=0, maxItems=0)', () => {
    const opts = resolveOptions({ source, debounce: 0, minChars: 0, maxItems: 0 });
    expect(opts.debounce).toBe(0);
    expect(opts.minChars).toBe(0);
    expect(opts.maxItems).toBe(0);
  });
});
