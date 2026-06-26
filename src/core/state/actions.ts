import type { SuggestionItem } from '../../types/SuggestionItem';

/** All action type string literals used by the state machine. */
export const ActionTypes = {
  QUERY_CHANGED: 'QUERY_CHANGED',
  FETCH_START: 'FETCH_START',
  RESULTS_READY: 'RESULTS_READY',
  NO_RESULTS: 'NO_RESULTS',
  FETCH_ERROR: 'FETCH_ERROR',
  ITEM_HIGHLIGHTED: 'ITEM_HIGHLIGHTED',
  ITEM_SELECTED: 'ITEM_SELECTED',
  CLOSE: 'CLOSE',
  OPEN_CACHED: 'OPEN_CACHED',
  DESTROY: 'DESTROY',
} as const;

/** Union of all valid action type strings. */
export type ActionType = (typeof ActionTypes)[keyof typeof ActionTypes];

/** Discriminated union of all actions that can be dispatched to the state machine. */
export type Action =
  | { type: 'QUERY_CHANGED'; query: string }
  | { type: 'FETCH_START'; query: string }
  | { type: 'RESULTS_READY'; items: SuggestionItem[]; query: string }
  | { type: 'NO_RESULTS'; query: string }
  | { type: 'FETCH_ERROR'; error: Error; query: string }
  | { type: 'ITEM_HIGHLIGHTED'; index: number }
  | { type: 'ITEM_SELECTED'; item: SuggestionItem; originalEvent: Event }
  | { type: 'CLOSE' }
  | { type: 'OPEN_CACHED'; items: SuggestionItem[] }
  | { type: 'DESTROY' };
