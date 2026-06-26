type AnyHandler = (...args: unknown[]) => void;

/**
 * Minimal publish/subscribe event bus used internally by Praescio.
 *
 * Handlers are stored in a `Map<string, Set<fn>>` so that duplicate
 * registrations of the same function reference are silently deduplicated.
 */
export class EventEmitter {
  private listeners = new Map<string, Set<AnyHandler>>();

  /**
   * Register a handler for `event`.
   * @returns An unsubscribe function — call it to remove the handler.
   */
  on(event: string, handler: AnyHandler): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /** Unregister a previously added handler. */
  off(event: string, handler: AnyHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /** Invoke all handlers registered for `event`, passing `args` as-is. */
  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(...args);
    }
  }

  /** Remove all listeners and release memory. */
  destroy(): void {
    this.listeners.clear();
  }
}
