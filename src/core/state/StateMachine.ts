/**
 * @fileoverview Finite-state machine (FSM) for the Praescio panel lifecycle.
 *
 * The FSM drives every visible state change. The `transition` function is a
 * pure reducer: given the current state and an action, it returns the next
 * state without mutation. This makes the logic trivially testable.
 *
 * ## Status graph
 *
 * ```
 *  idle ──FETCH_START──► loading ──RESULTS_READY──► open
 *   ▲                        │                       │
 *   │                    NO_RESULTS              ITEM_SELECTED
 *   │                        │                  CLOSE
 *   │                        ▼                       │
 *   └──────────────────── empty  ◄──────────────────┘
 *   │
 *   └── FETCH_ERROR ──► error ──CLOSE──► idle
 *   └── any CLOSE ────► idle
 *   └── DESTROY ──────► destroyed (terminal)
 * ```
 */

import type { Action } from './actions';
import type { SuggestionItem } from '../../types/SuggestionItem';

/** All possible status values for the suggestion panel. */
export type PanelStatus = 'idle' | 'loading' | 'open' | 'empty' | 'error' | 'destroyed';

export interface PraescioState {
  status: PanelStatus;
  query: string;
  items: SuggestionItem[];
  /** Index into `items` of the highlighted suggestion (-1 = none) */
  highlightedIndex: number;
  lastSelectedItem: SuggestionItem | null;
  error: Error | null;
}

export const INITIAL_STATE: PraescioState = {
  status: 'idle',
  query: '',
  items: [],
  highlightedIndex: -1,
  lastSelectedItem: null,
  error: null,
};

/** Pure transition function — never mutates state */
export function transition(state: PraescioState, action: Action): PraescioState {
  if (state.status === 'destroyed') return state;

  switch (action.type) {
    case 'QUERY_CHANGED':
      return {
        ...state,
        query: action.query,
        highlightedIndex: -1,
        // Keep items visible briefly while loading (they'll be replaced on RESULTS_READY)
        status:
          action.query.length === 0 ? 'idle' : state.status === 'open' ? 'open' : state.status,
      };

    case 'FETCH_START':
      return {
        ...state,
        query: action.query,
        status: 'loading',
        error: null,
        highlightedIndex: -1,
      };

    case 'RESULTS_READY':
      // Guard: only apply if this result still matches the current query
      if (action.query !== state.query) return state;
      return {
        ...state,
        status: 'open',
        items: action.items,
        highlightedIndex: -1,
        error: null,
      };

    case 'NO_RESULTS':
      if (action.query !== state.query) return state;
      return {
        ...state,
        status: 'empty',
        items: [],
        highlightedIndex: -1,
        error: null,
      };

    case 'FETCH_ERROR':
      if (action.query !== state.query) return state;
      return {
        ...state,
        status: 'error',
        items: [],
        highlightedIndex: -1,
        error: action.error,
      };

    case 'ITEM_HIGHLIGHTED':
      if (state.status !== 'open') return state;
      return { ...state, highlightedIndex: action.index };

    case 'ITEM_SELECTED':
      return {
        ...state,
        status: 'idle',
        highlightedIndex: -1,
        lastSelectedItem: action.item,
      };

    case 'CLOSE':
      return {
        ...state,
        status: 'idle',
        highlightedIndex: -1,
      };

    case 'OPEN_CACHED':
      return {
        ...state,
        status: 'open',
        items: action.items,
        highlightedIndex: -1,
        error: null,
      };

    case 'DESTROY':
      return { ...state, status: 'destroyed', items: [] };

    default:
      return state;
  }
}
