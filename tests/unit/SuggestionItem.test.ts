import { describe, it, expect } from 'vitest';
import { isSelectable, getItemValue, type SuggestionItem } from '../../src/types/SuggestionItem';

// ── isSelectable ─────────────────────────────────────────────────────────────

describe('isSelectable', () => {
  it.each<SuggestionItem>([
    { type: 'text', label: 'A' },
    { type: 'description', label: 'A', description: 'desc' },
    { type: 'link', label: 'A', href: '/a' },
    { type: 'icon', label: 'A', icon: 'fa fa-star' },
    { type: 'rich', label: 'A' },
    { type: 'custom', label: 'A' },
  ])('returns true for $type items', (item) => {
    expect(isSelectable(item)).toBe(true);
  });

  it('returns false for group headers', () => {
    expect(isSelectable({ type: 'group', label: 'Recent' })).toBe(false);
  });

  it('returns false for dividers', () => {
    expect(isSelectable({ type: 'divider' })).toBe(false);
  });
});

// ── getItemValue ─────────────────────────────────────────────────────────────

describe('getItemValue', () => {
  it('returns href for link items', () => {
    expect(getItemValue({ type: 'link', label: 'Docs', href: '/docs' })).toBe('/docs');
  });

  it('returns value when present on a text item', () => {
    expect(getItemValue({ type: 'text', label: 'Apple', value: 'apple' })).toBe('apple');
  });

  it('falls back to label when value is absent on a text item', () => {
    expect(getItemValue({ type: 'text', label: 'Apple' })).toBe('Apple');
  });

  it('returns value for rich items', () => {
    expect(getItemValue({ type: 'rich', label: 'John', value: 'john' })).toBe('john');
  });

  it('falls back to label for rich items without value', () => {
    expect(getItemValue({ type: 'rich', label: 'John' })).toBe('John');
  });

  it('returns value for custom items', () => {
    expect(getItemValue({ type: 'custom', label: 'Cmd', value: 'cmd-id' })).toBe('cmd-id');
  });

  it('falls back to label for custom items without value', () => {
    expect(getItemValue({ type: 'custom', label: 'Cmd' })).toBe('Cmd');
  });
});
