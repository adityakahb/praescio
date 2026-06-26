import { describe, it, expect } from 'vitest';
import { transition, INITIAL_STATE, type PraescioState } from '../../src/core/state/StateMachine';

const items = [
  { type: 'text' as const, label: 'Paris' },
  { type: 'text' as const, label: 'London' },
];

describe('StateMachine', () => {
  it('starts in idle state', () => {
    expect(INITIAL_STATE.status).toBe('idle');
  });

  it('FETCH_START → loading', () => {
    const next = transition(INITIAL_STATE, { type: 'FETCH_START', query: 'par' });
    expect(next.status).toBe('loading');
    expect(next.query).toBe('par');
    expect(next.highlightedIndex).toBe(-1);
  });

  it('RESULTS_READY → open', () => {
    const loading: PraescioState = { ...INITIAL_STATE, status: 'loading', query: 'par' };
    const next = transition(loading, { type: 'RESULTS_READY', items, query: 'par' });
    expect(next.status).toBe('open');
    expect(next.items).toHaveLength(2);
  });

  it('RESULTS_READY is ignored when query does not match', () => {
    const loading: PraescioState = { ...INITIAL_STATE, status: 'loading', query: 'lon' };
    const next = transition(loading, { type: 'RESULTS_READY', items, query: 'par' });
    expect(next).toBe(loading); // same reference — no change
  });

  it('NO_RESULTS → empty', () => {
    const loading: PraescioState = { ...INITIAL_STATE, status: 'loading', query: 'xyz' };
    const next = transition(loading, { type: 'NO_RESULTS', query: 'xyz' });
    expect(next.status).toBe('empty');
  });

  it('FETCH_ERROR → error', () => {
    const loading: PraescioState = { ...INITIAL_STATE, status: 'loading', query: 'xyz' };
    const err = new Error('Network error');
    const next = transition(loading, { type: 'FETCH_ERROR', error: err, query: 'xyz' });
    expect(next.status).toBe('error');
    expect(next.error).toBe(err);
  });

  it('ITEM_HIGHLIGHTED → updates index', () => {
    const open: PraescioState = { ...INITIAL_STATE, status: 'open', items, query: 'par' };
    const next = transition(open, { type: 'ITEM_HIGHLIGHTED', index: 1 });
    expect(next.highlightedIndex).toBe(1);
  });

  it('ITEM_HIGHLIGHTED is ignored when not open', () => {
    const next = transition(INITIAL_STATE, { type: 'ITEM_HIGHLIGHTED', index: 0 });
    expect(next).toBe(INITIAL_STATE);
  });

  it('ITEM_SELECTED → idle, clears highlight', () => {
    const open: PraescioState = {
      ...INITIAL_STATE,
      status: 'open',
      items,
      query: 'par',
      highlightedIndex: 0,
    };
    const mockEvent = {} as Event;
    const next = transition(open, {
      type: 'ITEM_SELECTED',
      item: items[0]!,
      originalEvent: mockEvent,
    });
    expect(next.status).toBe('idle');
    expect(next.highlightedIndex).toBe(-1);
    expect(next.lastSelectedItem).toBe(items[0]);
  });

  it('CLOSE → idle', () => {
    const open: PraescioState = { ...INITIAL_STATE, status: 'open', items, query: 'par' };
    const next = transition(open, { type: 'CLOSE' });
    expect(next.status).toBe('idle');
  });

  it('DESTROY → destroyed, items cleared', () => {
    const open: PraescioState = { ...INITIAL_STATE, status: 'open', items, query: 'par' };
    const next = transition(open, { type: 'DESTROY' });
    expect(next.status).toBe('destroyed');
    expect(next.items).toHaveLength(0);
  });

  it('destroyed state ignores all further actions', () => {
    const destroyed: PraescioState = { ...INITIAL_STATE, status: 'destroyed' };
    const next = transition(destroyed, { type: 'FETCH_START', query: 'a' });
    expect(next).toBe(destroyed);
  });

  it('OPEN_CACHED → open with provided items', () => {
    const next = transition(INITIAL_STATE, { type: 'OPEN_CACHED', items });
    expect(next.status).toBe('open');
    expect(next.items).toBe(items);
  });
});
