/**
 * @fileoverview Reactive state container that wraps the pure FSM transition
 * function with subscription support.
 *
 * Consumers dispatch {@link Action}s; the new state is computed by
 * {@link transition} and then broadcast to all subscribers. If the new state
 * is identical to the previous one (i.e. the transition was a no-op) no
 * notification is sent.
 */

import { transition, INITIAL_STATE, type PraescioState } from './StateMachine';
import type { Action } from './actions';

type Subscriber = (next: PraescioState, prev: PraescioState) => void;

/**
 * Thin observable wrapper around the Praescio FSM.
 * One instance is created per Praescio instance and shared across all
 * subsystems (data, rendering, a11y, keyboard).
 */
export class StateManager {
  private state: PraescioState = { ...INITIAL_STATE };
  private subscribers = new Set<Subscriber>();

  getState(): Readonly<PraescioState> {
    return this.state;
  }

  dispatch(action: Action): void {
    const prev = this.state;
    const next = transition(prev, action);
    if (next === prev) return;
    this.state = next;
    for (const sub of this.subscribers) {
      sub(next, prev);
    }
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  destroy(): void {
    this.subscribers.clear();
  }
}
