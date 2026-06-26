import { describe, it, expect, vi } from 'vitest';
import { StateManager } from '../../src/core/state/StateManager';
import { INITIAL_STATE } from '../../src/core/state/StateMachine';

const items = [{ type: 'text' as const, label: 'Paris' }];

describe('StateManager', () => {
  it('getState() returns the initial state', () => {
    const sm = new StateManager();
    expect(sm.getState()).toMatchObject(INITIAL_STATE);
  });

  it('dispatch() transitions state and notifies subscribers', () => {
    const sm = new StateManager();
    const listener = vi.fn();
    sm.subscribe(listener);
    sm.dispatch({ type: 'FETCH_START', query: 'par' });
    expect(listener).toHaveBeenCalledOnce();
    const [next, prev] = listener.mock.calls[0]!;
    expect(next.status).toBe('loading');
    expect(prev.status).toBe('idle');
  });

  it('dispatch() does not notify when state is unchanged (same reference)', () => {
    const sm = new StateManager();
    const listener = vi.fn();
    sm.subscribe(listener);
    // Dispatching ITEM_HIGHLIGHTED when not open → state unchanged
    sm.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 0 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe() returns an unsubscribe function', () => {
    const sm = new StateManager();
    const listener = vi.fn();
    const unsubscribe = sm.subscribe(listener);
    unsubscribe();
    sm.dispatch({ type: 'FETCH_START', query: 'x' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple subscribers are all notified', () => {
    const sm = new StateManager();
    const l1 = vi.fn();
    const l2 = vi.fn();
    sm.subscribe(l1);
    sm.subscribe(l2);
    sm.dispatch({ type: 'FETCH_START', query: 'q' });
    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
  });

  it('destroy() removes all subscribers', () => {
    const sm = new StateManager();
    const listener = vi.fn();
    sm.subscribe(listener);
    sm.destroy();
    sm.dispatch({ type: 'FETCH_START', query: 'q' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('getState() returns the updated state after dispatch', () => {
    const sm = new StateManager();
    sm.dispatch({ type: 'FETCH_START', query: 'abc' });
    expect(sm.getState().status).toBe('loading');
    expect(sm.getState().query).toBe('abc');
  });

  it('sequential dispatches produce correct final state', () => {
    const sm = new StateManager();
    sm.dispatch({ type: 'FETCH_START', query: 'lon' });
    sm.dispatch({ type: 'RESULTS_READY', items, query: 'lon' });
    sm.dispatch({ type: 'ITEM_HIGHLIGHTED', index: 0 });
    const state = sm.getState();
    expect(state.status).toBe('open');
    expect(state.highlightedIndex).toBe(0);
  });
});
