import { describe, it, expect } from 'vitest';
import { normaliseItem, normaliseItems } from '../../src/core/data/normalise';

describe('normaliseItem', () => {
  it('converts a plain string to a TextItem', () => {
    expect(normaliseItem('London')).toEqual({ type: 'text', label: 'London' });
  });

  it('passes through a valid SuggestionItem', () => {
    const item = { type: 'text' as const, label: 'Tokyo', value: 'tky' };
    expect(normaliseItem(item)).toBe(item);
  });

  it('duck-types { label } to TextItem', () => {
    const result = normaliseItem({ label: 'Berlin', value: 'ber' });
    expect(result).toMatchObject({ type: 'text', label: 'Berlin', value: 'ber' });
  });

  it('converts a number to TextItem with string label', () => {
    expect(normaliseItem(42)).toEqual({ type: 'text', label: '42' });
  });
});

describe('normaliseItems', () => {
  it('maps an array', () => {
    const result = normaliseItems(['Paris', 'Berlin']);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: 'text', label: 'Paris' });
  });
});
